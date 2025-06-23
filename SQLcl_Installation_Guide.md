# 🛠️ SQLcl Installation Guide for Windows

## Problem: `The system cannot find the file specified` when running SQLcl

The error occurs because SQLcl is not installed or not in the system PATH.

## Solution: Install and Configure SQLcl

### 📋 Prerequisites

- **Java 17 or higher** (SQLcl requires Java)
- **Windows 10/11**
- **Internet connection** for download

### 🚀 Step 1: Check Java Installation

First, verify Java is installed:

```powershell
java -version
```

If Java is not installed, download from: https://www.oracle.com/java/technologies/downloads/#java17

### 🚀 Step 2: Download SQLcl

**Option A: Direct Download (Recommended)**
```powershell
# Download SQLcl latest version
Invoke-WebRequest -Uri "https://download.oracle.com/otn_software/java/sqldeveloper/sqlcl-latest.zip" -OutFile "sqlcl-latest.zip"
```

**Option B: Manual Download**
1. Go to: https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/
2. Download `sqlcl-latest.zip`

### 🚀 Step 3: Install SQLcl

```powershell
# Create installation directory
New-Item -ItemType Directory -Path "C:\Oracle\SQLcl" -Force

# Extract SQLcl
Expand-Archive -Path "sqlcl-latest.zip" -DestinationPath "C:\Oracle\SQLcl" -Force

# The executable will be at: C:\Oracle\SQLcl\sqlcl\bin\sql.exe
```

### 🚀 Step 4: Add SQLcl to PATH

**Option A: PowerShell (Temporary - current session only)**
```powershell
$env:PATH += ";C:\Oracle\SQLcl\sqlcl\bin"
```

**Option B: Permanent PATH Update**
```powershell
# Add to system PATH permanently
[Environment]::SetEnvironmentVariable("PATH", $env:PATH + ";C:\Oracle\SQLcl\sqlcl\bin", [EnvironmentVariableTarget]::Machine)
```

**Option C: Manual PATH Update**
1. Press `Win + X` → System → Advanced system settings
2. Click "Environment Variables"
3. Under "System variables", find and select "Path"
4. Click "Edit" → "New"
5. Add: `C:\Oracle\SQLcl\sqlcl\bin`
6. Click "OK" to save

### 🚀 Step 5: Verify Installation

**Restart PowerShell/Command Prompt**, then test:

```powershell
sql -version
```

Expected output:
```
SQLcl: Release 25.1 Production on [date]
Copyright (c) 1982, 2024, Oracle. All rights reserved.
```

### 🚀 Step 6: Test Oracle Connection

```powershell
sql team25s5/team25s5.c017@c017-node3.infcs.de:1521/FREEPDB1
```

## 🔧 Alternative Solutions

### Solution 1: Update C# Code to Use Full Path

If you don't want to modify PATH, update the SqlclPgqlExecutor:

```csharp
// In SqlclPgqlExecutor.cs, modify the FileName:
var processInfo = new ProcessStartInfo
{
    FileName = @"C:\Oracle\SQLcl\sqlcl\bin\sql.exe",  // Full path
    Arguments = $"{_username}/{_password}@{_host} @\"{scriptPath}\"",
    // ... rest of config
};
```

### Solution 2: Portable Installation in Project

```powershell
# Download to project directory
cd "C:\Users\Administrator\knowledge_graph"
New-Item -ItemType Directory -Path "tools\sqlcl" -Force
Invoke-WebRequest -Uri "https://download.oracle.com/otn_software/java/sqldeveloper/sqlcl-latest.zip" -OutFile "tools\sqlcl-latest.zip"
Expand-Archive -Path "tools\sqlcl-latest.zip" -DestinationPath "tools\sqlcl" -Force
```

Then update C# code:
```csharp
var sqlclPath = Path.Combine(Directory.GetCurrentDirectory(), "tools", "sqlcl", "sqlcl", "bin", "sql.exe");
var processInfo = new ProcessStartInfo
{
    FileName = sqlclPath,
    // ... rest of config
};
```

## 🔍 Troubleshooting

### Issue: "Access Denied" when downloading
```powershell
# Run PowerShell as Administrator
Start-Process PowerShell -Verb RunAs
```

### Issue: Java not found
```powershell
# Check Java location
where java
# If not found, install Java 17+
```

### Issue: Still can't find SQL command
```powershell
# Check if sql.exe exists
Test-Path "C:\Oracle\SQLcl\sqlcl\bin\sql.exe"
# Check current PATH
$env:PATH -split ';' | Where-Object { $_ -like "*sqlcl*" }
```

### Issue: Oracle connection fails
```powershell
# Test network connectivity
Test-NetConnection -ComputerName "c017-node3.infcs.de" -Port 1521
```

## 🎯 Quick Install Script

Save this as `install-sqlcl.ps1` and run as Administrator:

```powershell
# Quick SQLcl Installation Script
Write-Host "🚀 Installing SQLcl..." -ForegroundColor Green

# Check Java
try {
    $javaVersion = java -version 2>&1
    Write-Host "✅ Java found: $($javaVersion[0])" -ForegroundColor Green
} catch {
    Write-Host "❌ Java not found. Please install Java 17+ first." -ForegroundColor Red
    exit 1
}

# Create directory
$sqlclDir = "C:\Oracle\SQLcl"
New-Item -ItemType Directory -Path $sqlclDir -Force | Out-Null

# Download SQLcl
Write-Host "📥 Downloading SQLcl..." -ForegroundColor Blue
Invoke-WebRequest -Uri "https://download.oracle.com/otn_software/java/sqldeveloper/sqlcl-latest.zip" -OutFile "$sqlclDir\sqlcl-latest.zip"

# Extract
Write-Host "📦 Extracting SQLcl..." -ForegroundColor Blue
Expand-Archive -Path "$sqlclDir\sqlcl-latest.zip" -DestinationPath $sqlclDir -Force

# Add to PATH
$sqlclBinPath = "$sqlclDir\sqlcl\bin"
$currentPath = [Environment]::GetEnvironmentVariable("PATH", [EnvironmentVariableTarget]::Machine)
if ($currentPath -notlike "*$sqlclBinPath*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$sqlclBinPath", [EnvironmentVariableTarget]::Machine)
    Write-Host "✅ Added SQLcl to system PATH" -ForegroundColor Green
}

# Cleanup
Remove-Item "$sqlclDir\sqlcl-latest.zip" -Force

Write-Host "🎉 SQLcl installation complete!" -ForegroundColor Green
Write-Host "📋 Please restart your terminal and run: sql -version" -ForegroundColor Yellow
```

## 🏃‍♂️ Quick Start

After installation, restart your terminal and run:

```bash
cd C:\Users\Administrator\knowledge_graph\App
dotnet run
```

The application should now successfully connect to Oracle and create the PGQL Property Graph! 🎉

## 📚 Next Steps

Once SQLcl is working:
1. ✅ Test connection: `sql -version`
2. ✅ Run your C# application: `dotnet run`
3. ✅ PGQL Property Graph will be created automatically
4. ✅ Visualization data will be retrieved

Your knowledge graph will now have full PGQL support for advanced graph queries! 🚀 