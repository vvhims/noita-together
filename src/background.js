'use strict'
const NT_SCHEME = "noitatogether"
const path = require("path")
import { autoUpdater } from "electron-updater"
import { app, protocol, BrowserWindow, dialog, ipcMain } from 'electron'
import { createProtocol } from 'vue-cli-plugin-electron-builder/lib'
import installExtension, { VUEJS_DEVTOOLS } from 'electron-devtools-installer'
import { updateMod } from "./update.js"
const appEvent = require("./appEvent")
const wsClient = require("./ws.js")
// Use later ?
// import keytar from "keytar"

const isDevelopment = process.env.NODE_ENV !== 'production'
const primaryInstance = app.requestSingleInstanceLock()
let mainWindow = null
// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
    { scheme: 'app', privileges: { secure: true, standard: true } }
])

if (!app.isDefaultProtocolClient(NT_SCHEME)) {
    app.setAsDefaultProtocolClient(NT_SCHEME)
}
autoUpdater.on('update-downloaded', (info) => {
    appEvent("UPDATE_DOWNLOADED", "")
});
async function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        title: "Noita Together",
        transparent: false,
        frame: false,
        thickFrame: true,
        width: 800,
        minWidth: 400,
        height: 700,
        minHeight: 600,
        backgroundColor: '#2e2c29',
        resizable: true,
        webPreferences: {
            // Use pluginOptions.nodeIntegration, leave this alone
            // See nklayman.github.io/vue-cli-plugin-electron-builder/guide/security.html#node-integration for more info
            nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
            enableRemoteModule: true
        }
    })

    if (process.env.WEBPACK_DEV_SERVER_URL) {
        // Load the url of the dev server if in development mode
        await mainWindow.loadURL(process.env.WEBPACK_DEV_SERVER_URL)
        if (!process.env.IS_TEST) mainWindow.webContents.openDevTools()
    } else {
        createProtocol('app')
        protocol.registerHttpProtocol(NT_SCHEME, (req, cb) => {
            dialog.showErrorBox(`NT: ${req.url}`)
        })
        // Load the index.html when not in development
        mainWindow.loadURL('app://./index.html')
        autoUpdater.checkForUpdatesAndNotify()
    }

    
}

ipcMain.on("update_mod", () => {
    updateMod()
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

if (!primaryInstance) {
    app.quit()
}
else {
    app.on("second-instance", (event, commandLine, workingDirectory) => {
        if (commandLine[2]) {//noitatogether://?display_name=test&token=abc321&refresh=idk456&id=1111
            let url = new URL(commandLine[2])
            let display_name = url.searchParams.get("display_name")
            let token = url.searchParams.get("token")
            let refreshToken = url.searchParams.get("refresh")
            let id = url.searchParams.get("id")
            wsClient({
                display_name,
                token,
                refreshToken,
                id
            })
        }
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore()
            }
            mainWindow.focus()
        }
    })
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    app.on('ready', async () => {
        if (isDevelopment && !process.env.IS_TEST) {
            // Install Vue Devtools
            try {
                await installExtension(VUEJS_DEVTOOLS)
            } catch (e) {
                console.error('Vue Devtools failed to install:', e.toString())
            }
        }
        createWindow()
    })
}

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                app.quit()
            }
        })
    } else {
        process.on('SIGTERM', () => {
            app.quit()
        })
    }
}