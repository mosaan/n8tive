# n8tive User Guide

Welcome to the n8tive User Guide. This document provides everything you need to know to get started with n8tive, the desktop wrapper for n8n.

## Introduction

n8tive is a lightweight desktop application that allows you to run n8n, the powerful workflow automation tool, directly on your Windows computer.

The primary goal of n8tive is to provide a seamless, "install and run" experience for n8n without requiring you to manually install Node.js or manage command-line environments. It wraps n8n in a native desktop shell, providing a familiar interface and system integration.

### Why use n8tive?
- No Node.js installation required.
- Easy installation via a standard Windows installer.
- Integrated system tray support for background operation.
- Automatic port management to avoid conflicts.
- Built-in logging and troubleshooting tools.

**Current Version:** 1.0.0+n8n.2.0.2 (Wrapper version 1.0.0, bundled with n8n 2.0.2)

---

## System Requirements

- **Operating System:** Windows 10 or Windows 11 (64-bit).
- **Disk Space:** Approximately 500MB for installation + space for your workflow data.
- **RAM:** Minimum 4GB (8GB recommended for complex workflows).

---

## Installation

n8tive is distributed as a standard Windows NSIS installer (`.exe`).

1. Download the latest `n8tive-Setup-x.x.x.exe` installer.
2. Double-click the installer to begin the installation process.
3. Follow the on-screen instructions.
4. Once finished, you can launch n8tive from your Start Menu or Desktop shortcut.

---

## Getting Started

### First Launch
When you launch n8tive for the first time, you will see a loading screen with a spinner. 

During this phase, the application is initializing the n8n environment and starting the background process. This process typically takes **30 to 60 seconds** on the first launch as it sets up necessary dependencies. Subsequent launches are usually faster.

You can see the startup logs directly on the loading screen to monitor the progress.

### Accessing the Interface
Once initialization is complete, the loading screen will disappear, and the main n8n editor interface will load automatically within the window.

n8tive runs n8n locally on your machine at the address `http://127.0.0.1` (localhost). By default, it uses port `5678`.

---

## Main Features

- **Local-Only Access:** For security, n8tive is configured to only allow connections from your local machine (127.0.0.1). It is not accessible from external networks by default.
- **Data Persistence:** All your workflows, credentials, and execution data are saved locally and persist even after restarting the application or your computer.
- **Background Operation:** Closing the main window does not stop n8n. The application continues to run in the background via the system tray.
- **Auto Port Detection:** If the default port (5678) is occupied by another application, n8tive will automatically search for the next available port (checking up to 100 ports).

---

## User Interface Guide

### Main Window
The main window hosts the n8n editor. You can use it just like the web version of n8n.

#### Application Menu Bar
- **File**
  - **Settings > Port Settings...**: Opens the dialog to change the application port.
  - **Settings > Reset to Auto**: Clears any manual port configuration and returns to automatic detection.
  - **Exit**: Fully closes the application and stops the background n8n process.
- **View**
  - **Reload**: Refreshes the current page (**Shortcut: Ctrl+R**).
  - **Toggle Developer Tools**: Opens the Chrome DevTools for debugging (**Shortcut: Ctrl+Shift+I**).
- **Help**
  - **View Logs...**: Opens the folder containing application logs in Windows Explorer.
  - **About n8tive**: Displays version information.

### System Tray
n8tive lives in your system tray (the area next to the clock in your taskbar).

- **Left-Click**: Show or hide the main application window.
- **Right-Click**: Opens the tray menu with the following options:
  - **Open**: Shows the main window.
  - **Settings**:
    - **Port Settings...**: Configure a custom port.
    - **Reset to Auto**: Revert to automatic port detection.
  - **View Logs...**: Opens the logs folder.
  - **Exit**: Fully shuts down n8tive and n8n.

---

## Configuration Options

### Port Settings
If you need n8tive to run on a specific port (e.g., if you have other services running), you can configure it manually.

1. Go to **File > Settings > Port Settings...** (or use the Tray menu).
2. Enter a port number between **1024** and **65535**.
3. Click **Save**.
4. The application will restart the n8n process to apply the new port.

### Reset to Auto
If you encounter issues with a manually set port, use the **Reset to Auto** option in the Settings menu. This will clear your custom preference and let n8tive find the first available port starting from 5678.

---

## Troubleshooting

### Port Conflicts
If n8tive cannot find an available port or fails to start because of a port conflict:
- Use the **Port Settings** dialog to set a specific port that you know is free.
- Or use **Reset to Auto** to let the application try searching again.

### Slow Startup
If the loading screen stays visible for more than 2 minutes:
- Check the logs displayed on the loading screen for any error messages.
- Click the **Restart** button if it appears on the loading screen.
- Ensure your antivirus or firewall is not blocking the application or the local connection to 127.0.0.1.

### How to View Logs
Logs are essential for diagnosing issues. You can access them by:
- Selecting **Help > View Logs...** from the application menu.
- Selecting **View Logs...** from the system tray menu.
- Manually navigating to `%APPDATA%/n8tive/logs/`.

### Resetting Settings
If the application is behaving unexpectedly, you can try resetting your configuration by deleting the `n8tive_config.json` file located in `%APPDATA%/n8tive/`.

---

## FAQ

**Q: Do I need to install Node.js?**
A: No, n8tive includes everything needed to run n8n.

**Q: Can I access my n8n instance from another computer?**
A: By default, no. n8tive is bound to `127.0.0.1` for security.

**Q: Where is my workflow data stored?**
A: All data is stored in your user profile: `%APPDATA%/n8tive/.n8n/`.

**Q: Will I lose my data if I update n8tive?**
A: No, your workflow data is stored separately from the application files and will persist through updates.

---

## Data Storage & Logs

n8tive uses the following locations on your Windows computer:

- **n8n Data:** `%APPDATA%/n8tive/.n8n/`
  - This folder contains your database, encryption keys, and binary data. **Back this up if you want to save your workflows.**
- **Application Config:** `%APPDATA%/n8tive/n8tive_config.json`
  - Stores your custom port preferences and other app-specific settings.
- **Logs:** `%APPDATA%/n8tive/logs/`
  - Contains daily log files (e.g., `n8n-2025-12-25.log`). These files are useful for troubleshooting.

---

*n8tive is an independent desktop wrapper for n8n and is not officially affiliated with n8n.io.*
