import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';

process.loadEnvFile('.env.local');
const origin='http://localhost:3101';
assert.equal(process.env.PAIR_EVAL_ENV,'development','Synthetic development only');
const database=new URL(process.env.DATABASE_URL);
assert.equal(database.hostname,'127.0.0.1','Local database only');
assert.equal(database.port,'55432','Expected presentation database port');
assert.equal(process.env.PAIR_EVAL_EXPECTED_DB_HOST,'127.0.0.1');
assert.equal(process.env.APP_ORIGIN,origin,'Expected local application origin');
const pool=new Pool({connectionString:process.env.DATABASE_URL,max:2});
const stateFile='.verification/presentation-final-v1.json';
const name='ตัวอย่างปิดงาน · คะแนนและอุทธรณ์';
const marker='[synthetic-final-demo:v1]';
const sessionIds=[],tokens=new Map();
let lock;
const save=async state=>{await mkdir('.verification',{recursive:true});await writeFile(stateFile,JSON.stringify(state,null,2)+'\n',{mode:0o600});};
const api=async(path,actor,method='GET',body)=>{
  const response=await fetch(origin+path,{method,headers:{Cookie:`paireval_full_session=${tokens.get(actor)}`,Origin:origin,
    'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(![200,201].includes(response.status))throw Error(`${method} ${path}: ${response.status} ${result.error?.code??'Request not confirmed; inspect before retrying'}`);
  return result.data;
};
try{
  const presentation=JSON.parse(await readFile('.verification/v20-20261015/presentation-state.json','utf8'));
  lock=await pool.connect();
  const acquired=(await lock.query("SELECT pg_try_advisory_lock(hashtext('paireval-final-demo-v1')) AS ok")).rows[0].ok;
  assert.ok(acquired,'Another preparation is running');
  const members=(await pool.query(`SELECT u.id,u.email_lookup,m.role FROM classroom_member m JOIN app_user u ON u.id=m.user_id
    JOIN classroom c ON c.id=m.classroom_id WHERE c.id=$1 AND c.name='PairEval · สาธิต PRD v2.0' AND m.membership_status='ACTIVE'`,[presentation.room])).rows;
  assert.ok(members.length>=17&&members.every(m=>/^v20-presentation-[a-z0-9]+@example\.test$/.test(m.email_lookup)),'Unexpected/non-synthetic cohort');
  const owner=members.find(m=>m.id===presentation.users.owner.id&&m.role==='OWNER');
  assert.ok(owner,'Expected synthetic Owner');
  const students=Array.from({length:16},(_,i)=>members.find(m=>m.id===presentation.users['s'+i].id&&m.role==='STUDENT'));
  assert.ok(students.every(Boolean),'Expected 16 prepared students');
  let state;
  try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(state){assert.equal(state.format,'synthetic-final-demo-v1');assert.equal(state.classroomId,presentation.room);}
  const existing=(await pool.query('SELECT id,status,generation,description FROM assignment WHERE classroom_id=$1 AND name=$2',[presentation.room,name])).rows;
  assert.ok(existing.length<=1,'Multiple matching assignments; inspect rather than recreate');
  if(state){assert.equal(existing[0]?.id,state.assignmentId,'Saved assignment does not match the named fixture');}
  if(existing[0])assert.ok(existing[0].description?.startsWith(marker),'Named assignment is not this fixture');
  if(state?.prepared){
    assert.ok(['OPEN','CLOSED','FINALIZED'].includes(existing[0].status),'Prepared fixture changed; inspect manually');
    console.log(JSON.stringify({assignmentId:state.assignmentId,status:existing[0].status,deadline:state.deadline,alreadyPrepared:true,unchanged:true}));
  }else{
    for(const person of [owner,...students]){
      const token=randomBytes(32).toString('hex'),id=randomUUID();tokens.set(person.id,token);sessionIds.push(id);
      await pool.query("INSERT INTO app_session(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",[id,person.id,createHash('sha256').update(token).digest('hex')]);
    }
    const deadline=new Date(Date.now()+5*60000).toISOString();
    const template=await api(`/api/full-system/assignments/${presentation.assignment}`,owner.id);
    const input={...template,name,description:`${marker} ข้อมูลจำลองสำหรับสาธิต Final การอุทธรณ์ และการแก้คะแนน`,groupDeadline:deadline,individualDeadline:deadline};
    if(!existing[0]){
      const created=await api('/api/assignments',owner.id,'POST',{...input,classroomId:presentation.room});
      state={format:'synthetic-final-demo-v1',classroomId:presentation.room,assignmentId:created.id,seed:'professor-final-v1',deadline,prepared:false};
      await save(state);
    }else{
      state??={format:'synthetic-final-demo-v1',classroomId:presentation.room,assignmentId:existing[0].id,seed:'professor-final-v1',prepared:false};
      state.deadline=deadline;await save(state);
      if(existing[0].status==='DRAFT')await api(`/api/assignments/${state.assignmentId}`,owner.id,'PATCH',input);
      else{
        assert.ok(['OPEN','CLOSED'].includes(existing[0].status),'An unfinished fixture was finalized; inspect manually');
        await api(`/api/full-system/assignments/${state.assignmentId}/deadlines`,owner.id,'POST',{groupDeadline:deadline,individualDeadline:deadline});
      }
    }
    const current=await api(`/api/full-system/assignments/${state.assignmentId}`,owner.id);
    if(current.status==='DRAFT')await api(`/api/assignments/${state.assignmentId}:publish`,owner.id,'POST',{seed:state.seed});
    for(const [index,person]of students.entries())for(const side of ['GROUP','INDIVIDUAL']){
      const evaluation=await api(`/api/assignments/${state.assignmentId}/my-evaluations?side=${side}`,person.id);
      if(evaluation.latestSubmission&&evaluation.pairs.every(p=>p.choice!==null))continue;
      assert.ok(!evaluation.readOnly,'Preparation deadline passed; rerun to extend only this unfinished fixture');
      for(const [n,pair]of evaluation.pairs.entries())await api(`/api/comparisons/${pair.id}`,person.id,'PUT',{choice:2+(index+n)%4});
      await api(`/api/assignments/${state.assignmentId}/submissions`,person.id,'POST',{side});
    }
    await api(`/api/assignments/${state.assignmentId}:recompute`,owner.id,'POST',{});
    state.prepared=true;state.preparedAt=new Date().toISOString();await save(state);
    console.log(JSON.stringify({assignmentId:state.assignmentId,deadline:state.deadline,prepared:true,students:16,clock:'real time; no database clock edits',next:'After the deadline, Owner calculates Interim and Final through the UI. Re-running preparation leaves this work unchanged.'}));
  }
}finally{
  if(sessionIds.length)await pool.query('DELETE FROM app_session WHERE id=ANY($1::uuid[])',[sessionIds]);
  if(lock){await lock.query("SELECT pg_advisory_unlock(hashtext('paireval-final-demo-v1'))");lock.release();}
  await pool.end();
}
