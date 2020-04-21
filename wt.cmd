@echo off
title build templates
if "%1"=="-b" (set W=) else set W=-w
if "%W%"=="" (set B=-b) else set B=
call set.cmd %B%
node build.js temp%W%