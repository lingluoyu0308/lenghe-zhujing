@echo off
chcp 65001 >nul
echo ========================================
echo   棱禾筑境 · 施工管理系统 - 桌面版构建脚本
echo ========================================
echo.

echo [1/3] 检查 Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js (https://nodejs.org/)
    pause
    exit /b 1
)
echo Node.js 已安装: 
node -v
echo.

echo [2/3] 安装依赖...
call npm install
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络或 npm 配置
    pause
    exit /b 1
)
echo 依赖安装完成
echo.

echo [3/3] 打包桌面应用 (Windows x64)...
call npm run build
if errorlevel 1 (
    echo [错误] 打包失败
    pause
    exit /b 1
)
echo.
echo ========================================
echo   构建完成！
echo   可执行文件位于: dist\棱禾筑境-win32-x64\
echo ========================================
pause
