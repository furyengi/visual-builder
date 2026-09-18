"use client";
import {createContext,Dispatch,ReactNode,useContext,useEffect,useReducer} from "react";
import {createNode,makeDocument,makeId} from "./document";
import {EditorAction,EditorDocument,EditorNode,EditorState} from "./types";
const KEY="formwork:document:v1";
const initial:EditorState={document:makeDocument(),selectedId:null,breakpoint:"desktop",zoom:.82,pan:{x:0,y:0},preview:false,leftTab:"insert",history:[],future:[],savedAt:null};
const snapshot=(s:EditorState)=>({document:s.document,selectedId:s.selectedId});
const commit=(s:EditorState,document:EditorDocument,selectedId=s.selectedId):EditorState=>({...s,document:{...document,updatedAt:Date.now()},selectedId,history:[...s.history.slice(-49),snapshot(s)],future:[]});
const descendants=(nodes:Record<string,EditorNode>,id:string):string[]=>[id,...nodes[id].children.flatMap(c=>descendants(nodes,c))];
function reducer(s:EditorState,a:EditorAction):EditorState{
 switch(a.type){
  case"SELECT":return{...s,selectedId:a.id}; case"SET_BREAKPOINT":return{...s,breakpoint:a.breakpoint}; case"SET_ZOOM":return{...s,zoom:Math.max(.25,Math.min(1.5,a.zoom))}; case"SET_PAN":return{...s,pan:a.pan}; case"TOGGLE_PREVIEW":return{...s,preview:!s.preview,selectedId:null}; case"SET_LEFT_TAB":return{...s,leftTab:a.tab}; case"MARK_SAVED":return{...s,savedAt:a.time}; case"LOAD":return{...s,document:a.document};
  case"ADD_NODE":{const parentId=a.parentId||s.selectedId||s.document.rootId,p=s.document.nodes[parentId],target=p&&["section","container"].includes(p.type)?parentId:(p?.parentId||s.document.rootId),n=createNode(a.kind,target);return commit(s,{...s.document,nodes:{...s.document.nodes,[n.id]:n,[target]:{...s.document.nodes[target],children:[...s.document.nodes[target].children,n.id]}}},n.id)}
  case"DELETE_NODE":{const id=a.id||s.selectedId;if(!id||id===s.document.rootId)return s;const n=s.document.nodes[id],nodes={...s.document.nodes};descendants(nodes,id).forEach(x=>delete nodes[x]);if(n.parentId)nodes[n.parentId]={...nodes[n.parentId],children:nodes[n.parentId].children.filter(x=>x!==id)};return commit(s,{...s.document,nodes},n.parentId)}
  case"DUPLICATE_NODE":{const id=a.id||s.selectedId;if(!id||id===s.document.rootId)return s;const src=s.document.nodes[id],nodes={...s.document.nodes};const clone=(oldId:string,parentId:string|null):string=>{const old=nodes[oldId],nid=makeId();const nn:EditorNode={...old,id:nid,parentId,children:[],styles:structuredClone(old.styles)};nodes[nid]=nn;nn.children=old.children.map(c=>clone(c,nid));return nid};const nid=clone(id,src.parentId);if(src.parentId){const p=nodes[src.parentId],idx=p.children.indexOf(id);nodes[src.parentId]={...p,children:[...p.children.slice(0,idx+1),nid,...p.children.slice(idx+1)]}}return commit(s,{...s.document,nodes},nid)}
  case"MOVE_NODE":{if(a.id===a.parentId||descendants(s.document.nodes,a.id).includes(a.parentId))return s;const nodes={...s.document.nodes},n=nodes[a.id];if(!n||a.id===s.document.rootId)return s;if(n.parentId)nodes[n.parentId]={...nodes[n.parentId],children:nodes[n.parentId].children.filter(x=>x!==a.id)};const dest=nodes[a.parentId],children=[...dest.children];children.splice(a.index??children.length,0,a.id);nodes[a.parentId]={...dest,children};nodes[a.id]={...n,parentId:a.parentId};return commit(s,{...s.document,nodes})}
  case"UPDATE_STYLE":{const id=a.id||s.selectedId;if(!id)return s;const n=s.document.nodes[id],current=n.styles[s.breakpoint]||{};return commit(s,{...s.document,nodes:{...s.document.nodes,[id]:{...n,styles:{...n.styles,[s.breakpoint]:{...current,...a.patch}}}}})}
  case"UPDATE_CONTENT":{const id=a.id||s.selectedId;if(!id)return s;const n=s.document.nodes[id];return commit(s,{...s.document,nodes:{...s.document.nodes,[id]:{...n,content:a.content}}})}
  case"UNDO":{const prev=s.history.at(-1);if(!prev)return s;return{...s,...prev,history:s.history.slice(0,-1),future:[snapshot(s),...s.future]}}
  case"REDO":{const next=s.future[0];if(!next)return s;return{...s,...next,history:[...s.history,snapshot(s)],future:s.future.slice(1)}}
 }
}
const C=createContext<{state:EditorState;dispatch:Dispatch<EditorAction>}|null>(null);
export function EditorProvider({children,blank=false}:{children:ReactNode;blank?:boolean}){const[state,dispatch]=useReducer(reducer,{...initial,document:makeDocument(blank)});useEffect(()=>{try{const raw=localStorage.getItem(KEY);if(raw&&!blank)dispatch({type:"LOAD",document:JSON.parse(raw)})}catch{}},[blank]);useEffect(()=>{const t=setTimeout(()=>{localStorage.setItem(KEY,JSON.stringify(state.document));dispatch({type:"MARK_SAVED",time:Date.now()})},500);return()=>clearTimeout(t)},[state.document]);return <C.Provider value={{state,dispatch}}>{children}</C.Provider>}
export const useEditor=()=>{const c=useContext(C);if(!c)throw Error("EditorProvider missing");return c};
