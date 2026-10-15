import type {NextRequest} from "next/server";import {observeRoute} from "@/lib/observe-route";import {assignmentActor,assignmentError} from "@/lib/full-system-assignment-http";import {archivedClassrooms} from "@/lib/full-system-archive";
export const runtime="nodejs";
export const GET=observeRoute(async(request:NextRequest)=>{const auth=await assignmentActor(request);if(auth.error)return auth.error;try{return Response.json({data:await archivedClassrooms(auth.actor)})}catch(e){return assignmentError(e)}});
