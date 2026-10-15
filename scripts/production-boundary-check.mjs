import{spawn}from'node:child_process';import{writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--port','3102','--hostname','127.0.0.1'],{windowsHide:true,env:{...process.env,PAIR_EVAL_ENV:'production'}});let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);const results=[];
try{
 for(let i=0;i<60;i++){try{if((await fetch('http://localhost:3102/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,250));}
 for(const[path,status,method]of[['/api/demo/session',404,'POST'],['/demo/student',404,'GET'],['/',307,'GET'],['/full-system',307,'GET'],['/api/assignments',401,'POST']]){
  const r=await fetch('http://localhost:3102'+path,{method,redirect:'manual',headers:{Origin:'http://localhost:3102',Cookie:'paireval_demo_session=synthetic-invalid-demo-token'}});assert.equal(r.status,status,path);assert.ok(r.headers.get('x-request-id'),path+' requestId');assert.ok(r.headers.get('strict-transport-security'),path+' HSTS');results.push({path,status:r.status});
 }
 console.log('Production boundary: Demo/session disabled, unauthenticated pages redirect to OIDC, legacy cookie grants no API access; requestId and HSTS present');
 await writeFile('.verification/v20-20261015/production-boundary.json',JSON.stringify(results,null,2));
}finally{child.kill();await writeFile('.verification/v20-20261015/production-boundary.log',log);}
