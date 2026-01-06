import React from 'react'
import { Theme } from 'src/shared/model/theme'

function App(): React.JSX.Element {
  async function handleThemeSwitch(id: string): Promise<void> {
    await window.themeApi.setTheme(id as Theme)
  }

  async function getTheme(): Promise<void> {
    const response = await window.themeApi.getTheme()
    console.log(response)
  }

  return (
    <div className="flex flex-row gap-4 w-screen h-screen items-center justify-center bg-red-50 dark:bg-amber-200">
      <button
        id="light"
        className="border rounded p-2 min-w-20 cursor-pointer"
        onClick={(e) => handleThemeSwitch(e.currentTarget.id)}
      >
        Light
      </button>
      <button
        id="dark"
        className="border rounded p-2 min-w-20 cursor-pointer"
        onClick={(e) => handleThemeSwitch(e.currentTarget.id)}
      >
        Dark
      </button>
      <button
        id="system"
        className="border rounded p-2 min-w-20 cursor-pointer"
        onClick={(e) => handleThemeSwitch(e.currentTarget.id)}
      >
        System
      </button>
      <button id="system" className="border rounded p-2 min-w-20 cursor-pointer" onClick={getTheme}>
        Get Theme
      </button>
    </div>
  )
}

export default App
