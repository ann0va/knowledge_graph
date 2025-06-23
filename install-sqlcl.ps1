# Quick SQLcl Installation Script for Windows
# Run this as Administrator

Write-Host "🚀 Installing Oracle SQLcl..." -ForegroundColor Green
Write-Host "📋 This will install SQLcl to C:\Oracle\SQLcl and add it to PATH" -ForegroundColor Yellow

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "❌ This script needs to be run as Administrator" -ForegroundColor Red
    Write-Host "📋 Please right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check Java
Write-Host "🔍 Checking Java installation..." -ForegroundColor Blue
try {
    $javaVersion = java -version 2>&1
    Write-Host "✅ Java found: $($javaVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "❌ Java not found. Installing Java is required." -ForegroundColor Red
    Write-Host "📋 Please download and install Java 17+ from:" -ForegroundColor Yellow
    Write-Host "   https://www.oracle.com/java/technologies/downloads/#java17" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Create directory
Write-Host "📁 Creating installation directory..." -ForegroundColor Blue
$sqlclDir = "C:\Oracle\SQLcl"
try {
    New-Item -ItemType Directory -Path $sqlclDir -Force | Out-Null
    Write-Host "✅ Directory created: $sqlclDir" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to create directory: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Download SQLcl
Write-Host "📥 Downloading SQLcl latest version..." -ForegroundColor Blue
$zipPath = "$sqlclDir\sqlcl-latest.zip"
try {
    Invoke-WebRequest -Uri "https://download.oracle.com/otn_software/java/sqldeveloper/sqlcl-latest.zip" -OutFile $zipPath -UseBasicParsing
    Write-Host "✅ Download completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to download SQLcl: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "📋 Please check your internet connection" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Extract
Write-Host "📦 Extracting SQLcl..." -ForegroundColor Blue
try {
    Expand-Archive -Path $zipPath -DestinationPath $sqlclDir -Force
    Write-Host "✅ Extraction completed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to extract SQLcl: $($_.Exception.Message)" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Verify extraction
$sqlExePath = "$sqlclDir\sqlcl\bin\sql.exe"
if (-not (Test-Path $sqlExePath)) {
    Write-Host "❌ SQLcl executable not found at expected location: $sqlExePath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Add to PATH
Write-Host "🔧 Adding SQLcl to system PATH..." -ForegroundColor Blue
$sqlclBinPath = "$sqlclDir\sqlcl\bin"
try {
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::Machine)
    if ($currentPath -notlike "*$sqlclBinPath*") {
        [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$sqlclBinPath", [EnvironmentVariableTarget]::Machine)
        Write-Host "✅ Added SQLcl to system PATH" -ForegroundColor Green
    } else {
        Write-Host "✅ SQLcl already in system PATH" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Failed to update PATH: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "📋 You may need to add manually: $sqlclBinPath" -ForegroundColor Yellow
}

# Cleanup
Write-Host "🧹 Cleaning up..." -ForegroundColor Blue
try {
    Remove-Item $zipPath -Force
    Write-Host "✅ Cleanup completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not remove zip file: $zipPath" -ForegroundColor Yellow
}

# Test installation
Write-Host "🔍 Testing SQLcl installation..." -ForegroundColor Blue
try {
    # Update PATH for current session
    $env:PATH += ";$sqlclBinPath"
    
    # Test sql command
    $sqlclTest = & "$sqlExePath" -version 2>&1
    if ($sqlclTest -like "*SQLcl*") {
        Write-Host "✅ SQLcl installation successful!" -ForegroundColor Green
        Write-Host "📋 Version: $($sqlclTest -split "`n" | Select-Object -First 1)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ SQLcl installed but version check failed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not verify installation: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 SQLcl installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Close and restart your PowerShell/Command Prompt" -ForegroundColor White
Write-Host "2. Test with: sql -version" -ForegroundColor White
Write-Host "3. Run your C# application: dotnet run" -ForegroundColor White
Write-Host ""
Write-Host "📍 SQLcl installed at: $sqlExePath" -ForegroundColor Cyan
Write-Host "📍 Added to PATH: $sqlclBinPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔗 Test Oracle connection with:" -ForegroundColor Yellow
Write-Host "sql team25s5/team25s5.c017@c017-node3.infcs.de:1521/FREEPDB1" -ForegroundColor White

Read-Host "Press Enter to exit" 