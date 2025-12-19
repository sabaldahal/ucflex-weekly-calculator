const prevWeekBtnValue = "#WD01D7";
const nextWeekBtnValue = "#WD01D8";
const timeTableBody = "WD01D5-aria";
const weekStartCell = 'td:nth-child(3) span span';
const actualHourCell = 'td:nth-child(6) span span';
const contentHourCell = 'td:nth-child(7) span span';
const startTimeCell = 'td:nth-child(9) span span';
const endTimeCell = 'td:nth-child(10) span span';

//button handlers
//next, prev, recalculate
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'prevWeek') {
    (async () =>{await handleButtonClick(prevWeekBtnValue, sendResponse)})();
    return true;
  }
  if (message.action === 'nextWeek') {
    (async () =>{await handleButtonClick(nextWeekBtnValue, sendResponse)})();
    return true;
  }
  if (message.action === 'recalculate') {
    (async () =>{await recalculate(sendResponse)})();
    return true;
  }
});

async function handleButtonClick(selector, sendResponse) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id){
    sendResponse({success: false, error: 'Could not get the tab ID'});
    return;
  }
  const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
  for (const frame of frames) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frame.frameId] },
        func: (sel) => {
          return !!document.querySelector(sel);
        },
        args: [selector],
      });

      if (result?.result === true) {
        //found the elements, now execute
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [frame.frameId] },
          func: (sel) => {
            const elem = document.querySelector(sel);
            if (elem) {
              // Try native click first
              elem.click();

              // If needed, dispatch mouse event:
              // const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
              // elem.dispatchEvent(evt);
            } else {
              console.warn('Element not found:', sel);
            }
          },
          args: [selector],
          world: 'MAIN',
        });
        setTimeout(async () => {
          await recalculate(sendResponse);
        }, 700);
        return;
      }
    } catch (e) {
      sendResponse({success: false, error: e.message});
      //frame access error:  e.message
      //console.warn(`Frame ${frame.frameId} access error:`, e.message);
    }
  }
}

async function recalculate(sendResponse) {
  // Get the active tab in current window
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    sendResponse({ success: false, error: 'No active tab found'});
    return;
  }

  try {
    // Get all frames in this tab
    const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });

    // For each frame, try injecting code to find the table and sum hours
    for (const frame of frames) {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [frame.frameId] },
        func: (ttbody) => {
          return !!document.getElementById(ttbody);
        },
        args: [timeTableBody],
        world: 'MAIN',
      });
      if (result?.result === true) {
        try {
          const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id, frameIds: [frame.frameId] },
            func: (timeTableBody, weekStartCell, actualHourCell, contentHourCell, startTimeCell, endTimeCell) => {
              const tbody = document.getElementById(timeTableBody);
              if (!tbody) return { total: 0, errors: ['Table not found in this frame'], info: 'unknown' };

              let total = 0;
              let errors = [];
              let dailyHours = [];
              const rows = tbody.querySelectorAll('tr');
              let info = 'unknown';

              const rowsArr = Array.from(tbody.getElementsByTagName("tr"));
              const dataRows = rowsArr.filter(row => row.getElementsByTagName("td").length > 5);
              const firstDataRow = dataRows[1];
              info = firstDataRow.querySelector(weekStartCell).textContent;
              let unfinishedClock = null;

              rows.forEach((row, i) => {
                const hoursCell = row.querySelector(actualHourCell);
                const contentCell = row.querySelector(contentHourCell);
                const startTime = row.querySelector(startTimeCell);
                const endTime = row.querySelector(endTimeCell);

                if (!hoursCell) {
                  //errors.push(`Row ${i + 1}: Missing 6th column`);
                  if(contentCell){
                    if(endTime.textContent=="23:59"){
                      unfinishedClock = {
                        start: startTime.textContent,
                        content: contentCell.textContent,
                                               
                      }
                    }else{
                      dailyHours.push({
                        start: startTime.textContent,
                        end: endTime.textContent
                      })                      
                    }
                  }
                  return;
                }

                const value = parseFloat(hoursCell.textContent);
                if (isNaN(value)) {
                  //errors.push(`Row ${i + 1}: Invalid number format`);
                  return;
                }
                if(startTime){
                  
                  if(value==0){
                    unfinishedClock = {
                      start: startTime.textContent,
                      content: contentCell.textContent
                    }
                  }else{
                    dailyHours.push({
                      start: startTime.textContent,
                      end: endTime.textContent
                    })
                  }
                }
                total += value;

              });
              let data = {
                  totalHours: total,
                  week: info,
                  dailyHours: dailyHours,
                  unfinishedClock: unfinishedClock,
                  errors: errors
              };
              return data;
            },
            args: [timeTableBody, weekStartCell, actualHourCell, contentHourCell, startTimeCell, endTimeCell],
            world: 'MAIN'
          });

          // Process results
          if (results && results.length > 0) {
            const data = results[0].result;
            sendResponse({success: true, data: data});
            return; // stop at first successful frame                 
          }
        } catch (frameErr) {
          sendResponse({success: false, error: e.message});
          return;
          // Ignore frames that cause injection error and continue
          // console.error('Frame injection error:', frameErr);
        }
      }
    }

    // If no frame had the table
    sendResponse({success: false, error: 'No frame contains the required table'});
    return;
  } catch (err) {
    sendResponse({ success: false, error: err.message});
    return;
  }
}
