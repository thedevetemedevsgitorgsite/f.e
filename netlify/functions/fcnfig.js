// netlify/functions/fcnfig.js
export async function handler(){return{statusCode:200,body:JSON.stringify({url:process.env.PUBLIC_SUPA_URL,key:process.env.PUBLIC_SUPA_API})}}
