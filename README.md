# VTC attendance checker (VTC 出席率checker)
![VTC attendance checker](img/img.png)
A browser bookmarklet for checking attendance across VTC modules.

Website: <https://kitzure.github.io/vtc-attendance-checker/>


## How it gets your data

The bookmarklet runs on the VTC page while you are signed in. It uses the browser's existing VTC session, so it reads data for the currently logged-in student and does not send it to a separate server.

1. It finds the VTC Calendar link and fetches the student's scheduled lessons from the VTC calendar API.
2. It opens Profile > Class Attendance in a hidden iframe and reads the module list and attendance form.
3. It submits that form for each module, then reads the returned attendance table: status, arrival time, and lesson duration.
4. It compares attended minutes with scheduled calendar hours and displays current and best-case attendance rates.

The result is shown in a dashboard and saved locally in the browser as `vtc-integrated-data`. The default threshold is 70%.

## How the attendance rate is calculated

The checker uses the VTC calendar and the module attendance records to work out a percentage for each module:

1. It finds each module’s scheduled lessons from the VTC calendar and totals the lesson minutes for that module.
2. It submits the attendance form for each module and reads every lesson row: status, arrival time, and lesson time.
3. It calculates the attended time for each lesson:
   - `Present` = full lesson duration is counted as attended
   - `Late` = the late minutes are deducted from that lesson, so only the remaining useful time counts
   - `Absent` = 0 minutes are counted
4. It totals the attended minutes for the module: `attendedMinutes = sum of counted lesson minutes`.
5. It calculates the current rate from recorded lessons only: `currentRate = attendedMinutes / recordMinutes × 100`.
6. It calculates the best possible full-term rate using all scheduled lessons: `bestPossibleRate = (attendedMinutes + futureMinutes) / calendarMinutes × 100`.
7. If the current rate is below the default threshold of 70%, it shows whether the module can still reach 70% if all remaining lessons are attended.

In short, the app compares:

- recorded attended time vs. recorded lesson time for the current percentage
- attended time + all future scheduled lesson time vs. total scheduled lesson time for the project full-term percentage

## Notes

- This repo is 100% vibe-coded. If you have any questions, don't ask me.
- Results are for reference only and are not guaranteed to be 100% accurate.
- The grabber depends on the VTC portal's current links, forms, and page structure.
- Do not refresh or leave the page while it is running.
