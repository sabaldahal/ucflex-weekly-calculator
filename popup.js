//returns total time in mins
const parseTime = (start, end) =>{
  const [s_hours, s_mins] = start.split(":").map(Number);
  if(end){
    const [e_hours, e_mins] = end.split(":").map(Number);
    let s = s_hours*60 + s_mins;
    let e = e_hours*60 + e_mins;
    return e - s;
  }else{
    return 0;
  }
}

const calculateActualMins = (dailyHours) => {
  let total = 0.00;
  dailyHours.forEach((item) => {
    let totalMins = parseTime(item.start, item.end);
    total += totalMins;
  })
  return total % 60;
}

const CalculateClockOutTime = (unfinishedClock, remHours, remMins) => {
  let date = new Date()
  if(unfinishedClock){
    const [hr, min] = unfinishedClock.start.split(":").map(Number);
    let pos_time = parseFloat(unfinishedClock.content);

    // if((hr+(min/60)) >= pos_time){
    //   return{
    //     hour: "Warning!",
    //     min: "Cannot meet the desired hours by 12:00 am"
    //   }
    // }
    date.setHours(hr+remHours)
    date.setMinutes(min+remMins)
    final_hr = date.getHours();

    return{
      hour: final_hr > 12 ? (final_hr-12) : final_hr,
      min: date.getMinutes() + (final_hr >= 12 ? " pm" : " am")
    }
  }else{
    return{
      hour: "Warning!",
      min: "No unfinished clock found"
    }
  }

}




document.addEventListener('DOMContentLoaded', () => {
  const totalTabBtn = document.querySelector('[data-tab="total"]');
  const errorsTabBtn = document.querySelector('[data-tab="errors"]');
  const totalTab = document.getElementById('tab-total');
  const errorsTab = document.getElementById('tab-errors');

  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  const recalculateBtn = document.getElementById('recalculateBtn');
  const clearErrorsBtn = document.getElementById('clearErrorsBtn');

  const weekLabel = document.getElementById('weekLabel');
  const totalTimeEl = document.getElementById('totalTime');
  const totalHoursEl = document.getElementById('totalHours');
  const decimalMinutesEl = document.getElementById('decimalMinutes');
  const actualMinutesEl = document.getElementById('actualMinutes');
  const errorList = document.getElementById('errorList');

  const desiredHoursEl = document.getElementById('desiredHours');
  const clockOutSuggestion = document.getElementById('clockOutSuggestion');
  const clockOutAt = document.getElementById('clockOutAt');
 
  // Tab switching
  [totalTabBtn, errorsTabBtn].forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // --- Messaging helpers ---
  const sendActionToBackground = (action) => {

    chrome.runtime.sendMessage({ action }, (response) => {
      if (chrome.runtime.lastError) {
        errorList.innerHTML = 'Error: ' + chrome.runtime.lastError.message;
        return;
      }

      if (!response) return;
      if(!response.success){
        errorList.innerHTML = response.error;
        return;
      }

      
      //const { total, errors, info, decimalMinutes, actualMinutes } = response;
      weekLabel.textContent = response.data.week || 'Week unknown';
      totalTimeEl.textContent = response.data.totalHours.toFixed(2);
      totalHoursEl.textContent = Math.trunc(response.data.totalHours);
      decimalMinutesEl.textContent = (response.data.totalHours % 1).toFixed(2) * 60;
      actualMinutesEl.textContent = calculateActualMins(response.data.dailyHours);
      let des_hours = parseFloat(desiredHoursEl.value);
      let worked_hours = Math.trunc(response.data.totalHours);
      let rem_mins = (des_hours*60)-(worked_hours*60 + parseFloat(actualMinutesEl.textContent))
      let final_rem_hours = Math.trunc(rem_mins/60);
      let final_rem_mins = rem_mins % 60
      clockOutSuggestion.textContent = `Time Remaining: ${final_rem_hours}:${final_rem_mins}`;
      let getclockouttime = CalculateClockOutTime(response.data.unfinishedClock, final_rem_hours, final_rem_mins);
      clockOutAt.textContent = `Clock Out At: ${getclockouttime.hour}:${getclockouttime.min}`;
      // Show errors
      errorList.innerHTML = '';
      (response.data.errors || []).forEach(e => {
        const li = document.createElement('li');
        li.textContent = e;
        errorList.appendChild(li);
      });
    });
  };

  // --- Button handlers ---
  prevWeekBtn.addEventListener('click', () => sendActionToBackground('prevWeek'));
  nextWeekBtn.addEventListener('click', () => sendActionToBackground('nextWeek'));
  recalculateBtn.addEventListener('click', () => sendActionToBackground('recalculate'));
  clearErrorsBtn.addEventListener('click', () => {
    errorList.innerHTML = '';
  });



  //desiredHours Event listener
  desiredHoursEl.addEventListener("input", () => sendActionToBackground('recalculate'));

  // Initial load
  sendActionToBackground('recalculate');
});

  