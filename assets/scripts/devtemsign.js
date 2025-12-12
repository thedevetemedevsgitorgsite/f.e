import{createClient}from"https://esm.sh/@supabase/supabase-js@2";const btnDr=document.getElementById("btttn");btnDr&&(window.addEventListener("scroll",(function(){window.pageYOffset>=300?btnDr.style.display="block":btnDr.style.display="none"})),btnDr.addEventListener("click",(function(){window.scrollTo({top:0,behavior:"smooth"})})));const res=await fetch("/.netlify/functions/fcnfig");const{url,key}=await res.json();
export const supabase=createClient(url,key);  
 function backTo(){
if (window.history.length > 1) {
window.history.back();
} else {
window.location.href = "/home";
}
 }
async function verifyRecaptcha() {
  const token = grecaptcha.getResponse();
  if (!token) {
    cAlert("❌ Please complete the reCAPTCHA", "warning", "Error");
    return false;
  }const response = await fetch('/.netlify/functions/verify-recaptcha', {method: 'POST',body: JSON.stringify({ token })});const result = await response.json();if (!result.success) {
    cAlert("❌ reCAPTCHA verification failed", "warning", "Error");
    return false;
  }return true;}document.getElementById("submitable").addEventListener("submit",(async e=>{e.preventDefault();if(!await verifyRecaptcha())return;const a=document.querySelector("#signEmail").value,r=document.querySelector("#signPsw").value,t=document.querySelector("#signFullName").value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),s=document.querySelector("#signUserName")?.value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")||t.trim().replace(/\W+/g,"_").toLowerCase(),l=document.querySelector("#signBio").value.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"),c=document.querySelector("#signSkill").value,o=document.querySelector("#signImg");try{const{data:e,error:i}=await supabase.auth.signUp({email:a,password:r});if(i)throw i;const n=e.user;let u="https://placehold.co/100x100";if(o.files.length>0){const e=o.files[0],a=`avatars/${n.id}_${Date.now()}_${e.name}`,{error:r}=await supabase.storage.from("avatars").upload(a,e);if(!r){const{data:e}=supabase.storage.from("avatars").getPublicUrl(a);u=e.publicUrl}}const{error:g}=await supabase.from("profiles").insert([{id:n.id,username:s,full_name:t,bio:l,skills:c,email:a,photo_url:u,created_at:new Date}]);if(g)throw g;cAlert("✅ Signup successful!","success","Success"),backTo()}catch(e){cAlert("❌ Error: "+e.message,"warning","Error")}finally{grecaptcha.reset()}})),document.querySelector("#haveAcct form").addEventListener("submit",(async e=>{e.preventDefault();const a=document.querySelector("#logEmail").value,r=document.querySelector("#logPsw").value;try{const{error:e}=await supabase.auth.signInWithPassword({email:a,password:r});if(e)throw e;cAlert("✅ Logged in successfully!","success","Logged in"),backTo()}catch(e){cAlert("❌ Login failed: "+e.message,"warning","Error")}finally{grecaptcha.reset()}}));
document.querySelector("footer .footer-bottom p:first-child").innerHTML=`&copy; ${new Date().getFullYear()} - DevTemple. All Rights Reserved.`;
