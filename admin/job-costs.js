import { supabase } from "/supabase-client.js";

const $ = (id) => document.getElementById(id);
const dollars = (n) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(n)||0);
const clean = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const today = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-"); };
const categories={supplies:"Supplies & chemicals",equipment:"Equipment & rental",labor:"Labor",fuel:"Fuel",parking_tolls:"Parking & tolls",subcontractor:"Subcontractor",other:"Other"};
let allJobs=[], allProposals=[], selectedId=null, expenses=[], trips=[], requestSequence=0;
let initialized=false;
function message(text,isError=false){ const n=$("costStatus");n.textContent=text;n.className="form-status"+(isError?" error":""); }
function resetExpense(){ $("costExpenseForm").reset(); $("costExpenseId").value=""; $("costExpenseDate").value=today(); $("expenseHeading").textContent="Add expense"; }
function resetTrip(){ $("costMileageForm").reset(); $("costMileageId").value=""; $("costTripDate").value=today(); $("mileageHeading").textContent="Log trip"; }
function selectedJob(){return allJobs.find(j=>j.id===selectedId);}
function proposalAmount(job){return Number(allProposals.find(p=>p.id===job?.proposal_id)?.total)||0;}
function summary(){
 const revenue=proposalAmount(selectedJob()),cost=expenses.reduce((s,x)=>s+Number(x.amount),0),miles=trips.reduce((s,x)=>s+Number(x.miles),0);
 const allowance=trips.reduce((s,x)=>s+Number(x.miles)*Number(x.rate_per_mile),0);
 $("costRevenue").textContent=dollars(revenue);
 $("costExpenses").textContent=dollars(cost);
 $("costMileageAmount").textContent=dollars(allowance);
 $("costMiles").textContent=Number(miles.toFixed(2)).toLocaleString()+" miles";
 $("costMargin").textContent=dollars(revenue-cost-allowance);
}
function renderLogs(){
 $("costExpenseList").innerHTML=expenses.length?expenses.map(x=>'<div class="cost-record"><div><strong>'+clean(categories[x.category]||x.category)+' · '+dollars(x.amount)+'</strong><span>'+clean(x.expense_date)+' · '+clean(x.description)+(x.vendor?' · '+clean(x.vendor):'')+'</span></div><div><button type="button" data-edit-expense="'+x.id+'">Edit</button> <button type="button" data-delete-expense="'+x.id+'">Delete</button></div></div>').join(""):'<div class="empty-state">No expenses recorded.</div>';
 $("costMileageList").innerHTML=trips.length?trips.map(x=>'<div class="cost-record"><div><strong>'+Number(x.miles).toLocaleString()+' miles · '+dollars(Number(x.miles)*Number(x.rate_per_mile))+'</strong><span>'+clean(x.trip_date)+' · '+clean(x.purpose)+(x.origin||x.destination?' · '+clean(x.origin||"")+" → "+clean(x.destination||""):"")+'</span></div><div><button type="button" data-edit-trip="'+x.id+'">Edit</button> <button type="button" data-delete-trip="'+x.id+'">Delete</button></div></div>').join(""):'<div class="empty-state">No trips recorded.</div>';
}
async function load(){
 const serial=++requestSequence;
 $("costWorkspace").hidden=!selectedId;
 if(!selectedId){message("Select a job to begin.");return;}
 message("Loading job costs...");
 const [e,t]=await Promise.all([
   supabase.from("job_expenses").select("*").eq("job_id",selectedId).order("expense_date",{ascending:false}).order("created_at",{ascending:false}),
   supabase.from("job_mileage").select("*").eq("job_id",selectedId).order("trip_date",{ascending:false}).order("created_at",{ascending:false})
 ]);
 if(serial!==requestSequence)return;
 if(e.error||t.error){message("Could not load job costs: "+(e.error||t.error).message,true);$("costWorkspace").hidden=true;return;}
 expenses=e.data||[];trips=t.data||[];
 summary();renderLogs();message("");
}
export function updateJobCostOptions(jobs,proposals){
 allJobs=jobs||[];allProposals=proposals||[];
 const picker=$("costJobSelect"); if(!picker)return;
 const previous=selectedId;
 picker.innerHTML='<option value="">Choose a job</option>'+allJobs.map(j=>'<option value="'+clean(j.id)+'">'+clean(j.client_name||"Client")+' — '+clean(j.title||"Cleaning job")+' ('+clean(j.status||"") +')</option>').join("");
 selectedId=allJobs.some(j=>j.id===previous)?previous:null;picker.value=selectedId||"";
 if(selectedId)summary();
 else {$("costWorkspace").hidden=true;message(allJobs.length?"Select a job to track costs.":"Accepted proposals will appear here as jobs.");}
}
export function openJobCosts(id){const picker=$("costJobSelect");if(!picker)return;picker.value=id;selectedId=id;resetExpense();resetTrip();load();}
export function initializeJobCosts(){
 if(initialized)return;initialized=true;
 $("costJobSelect").addEventListener("change",()=>{selectedId=$("costJobSelect").value||null;resetExpense();resetTrip();load();});
 $("costExpenseCancel").addEventListener("click",resetExpense);
 $("costMileageCancel").addEventListener("click",resetTrip);
 resetExpense();resetTrip();
 $("costExpenseForm").addEventListener("submit",async event=>{
   event.preventDefault();if(!selectedId)return;
   const id=$("costExpenseId").value;
   const record={job_id:selectedId,expense_date:$("costExpenseDate").value,category:$("costExpenseCategory").value,amount:Number($("costExpenseAmount").value),vendor:$("costExpenseVendor").value.trim()||null,description:$("costExpenseDescription").value.trim()};
   if(!Number.isFinite(record.amount)||record.amount<0||!record.description){message("Enter a valid amount and description.",true);return;}
   const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
   const response=id?await supabase.from("job_expenses").update(record).eq("id",id).eq("job_id",selectedId).select("id").single():await supabase.from("job_expenses").insert(record).select("id").single();
   button.disabled=false;
   if(response.error){message("Could not save expense: "+response.error.message,true);return;}
   resetExpense();await load();
 });
 $("costMileageForm").addEventListener("submit",async event=>{
   event.preventDefault();if(!selectedId)return;
   const id=$("costMileageId").value;
   const record={job_id:selectedId,trip_date:$("costTripDate").value,miles:Number($("costTripMiles").value),rate_per_mile:Number($("costTripRate").value||0),origin:$("costTripOrigin").value.trim()||null,destination:$("costTripDestination").value.trim()||null,purpose:$("costTripPurpose").value.trim()||"Job travel",notes:$("costTripNotes").value.trim()||null};
   if(!Number.isFinite(record.miles)||record.miles<0||!Number.isFinite(record.rate_per_mile)||record.rate_per_mile<0){message("Enter valid mileage and rate.",true);return;}
   const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
   const response=id?await supabase.from("job_mileage").update(record).eq("id",id).eq("job_id",selectedId).select("id").single():await supabase.from("job_mileage").insert(record).select("id").single();
   button.disabled=false;
   if(response.error){message("Could not save trip: "+response.error.message,true);return;}
   resetTrip();await load();
 });
 $("costWorkspace").addEventListener("click",async event=>{
   const b=event.target.closest("button[data-edit-expense],button[data-delete-expense],button[data-edit-trip],button[data-delete-trip]");
   if(!b)return;
   if(b.dataset.editExpense){const x=expenses.find(x=>x.id===b.dataset.editExpense);if(!x)return;
     $("costExpenseId").value=x.id;$("costExpenseDate").value=x.expense_date;$("costExpenseCategory").value=x.category;$("costExpenseAmount").value=x.amount;$("costExpenseVendor").value=x.vendor||"";$("costExpenseDescription").value=x.description;$("expenseHeading").textContent="Edit expense";$("costExpenseForm").scrollIntoView({behavior:"smooth",block:"center"});return;}
   if(b.dataset.editTrip){const x=trips.find(x=>x.id===b.dataset.editTrip);if(!x)return;
     $("costMileageId").value=x.id;$("costTripDate").value=x.trip_date;$("costTripMiles").value=x.miles;$("costTripRate").value=x.rate_per_mile;$("costTripOrigin").value=x.origin||"";$("costTripDestination").value=x.destination||"";$("costTripPurpose").value=x.purpose;$("costTripNotes").value=x.notes||"";$("mileageHeading").textContent="Edit trip";$("costMileageForm").scrollIntoView({behavior:"smooth",block:"center"});return;}
   const isExpense=!!b.dataset.deleteExpense, id=b.dataset.deleteExpense||b.dataset.deleteTrip;
   if(!window.confirm("Delete this "+(isExpense?"expense":"trip")+" record?"))return;
   b.disabled=true;
   const {error}=await supabase.from(isExpense?"job_expenses":"job_mileage").delete().eq("id",id).eq("job_id",selectedId).select("id").single();
   if(error){message("Could not delete record: "+error.message,true);b.disabled=false;return;}
   await load();
 });
}
