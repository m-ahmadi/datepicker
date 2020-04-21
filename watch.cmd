@echo off
start wt.cmd
start wl.cmd
REM start wsr.cmd (L22: count==7)
timeout 1
start ws.cmd
start wj.cmd
start wh.cmd

where cmdow
if %errorlevel% == 1 (echo cmdow not installed. && exit /b 1)

setlocal EnableDelayedExpansion
set count=0
set top=-267
set left=1430
set step=110
for /f %%i in ('cmdow /t') do (
	cmdow %%i /mov !left! !top!
	set /a "top=!top!+!step!"
	set /a "count=!count!+1"
	if "!count!" == "6" goto :done
)
:done
setlocal DisableDelayedExpansion
REM dsktop: top=-267       left=1430 step=110 (set.cmd: lines=5)
REM laptop: top=wsr?62:156 left=875  step=95  (set.cmd: lines=4)