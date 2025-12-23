import { exec } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

export class ClipboardError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'ClipboardError'
  }
}

function generateTempFilePath(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return path.join(os.tmpdir(), `clipboard-${timestamp}-${random}.png`)
}

async function saveClipboardImageDarwin(outputPath: string): Promise<void> {
  // Try pngpaste first (faster and more reliable)
  try {
    await execAsync(`pngpaste "${outputPath}"`)
    return
  }
  catch {
    // pngpaste not installed or failed, fall back to osascript
  }

  // Fallback: use osascript with NSPasteboard
  const script = `
    use framework "AppKit"
    use scripting additions

    set pb to current application's NSPasteboard's generalPasteboard()
    set imgData to pb's dataForType:(current application's NSPasteboardTypePNG)

    if imgData is missing value then
      set imgData to pb's dataForType:(current application's NSPasteboardTypeTIFF)
      if imgData is missing value then
        error "No image data in clipboard"
      end if
      -- Convert TIFF to PNG
      set bitmapRep to current application's NSBitmapImageRep's imageRepWithData:imgData
      set imgData to bitmapRep's representationUsingType:(current application's NSPNGFileType) |properties|:(missing value)
    end if

    set filePath to POSIX file "${outputPath}"
    imgData's writeToFile:filePath atomically:true
  `

  try {
    await execAsync(`osascript -e '${script.replace(/'/g, '\'"\'"\'')}'`)
  }
  catch (err) {
    throw new ClipboardError(
      'No image in clipboard. Install pngpaste for better support: brew install pngpaste',
      err instanceof Error ? err : undefined,
    )
  }
}

async function saveClipboardImageLinux(outputPath: string): Promise<void> {
  // Try xclip first
  try {
    await execAsync(`xclip -selection clipboard -t image/png -o > "${outputPath}"`)
    // Verify the file is not empty
    const stats = await fs.promises.stat(outputPath)
    if (stats.size > 0) {
      return
    }
    await fs.promises.unlink(outputPath)
  }
  catch {
    // xclip failed, try xsel
  }

  // Try xsel as fallback
  try {
    await execAsync(`xsel --clipboard --output > "${outputPath}"`)
    const stats = await fs.promises.stat(outputPath)
    if (stats.size > 0) {
      return
    }
    await fs.promises.unlink(outputPath)
  }
  catch {
    // xsel also failed
  }

  throw new ClipboardError(
    'No image in clipboard or missing clipboard tools. Install xclip: sudo apt install xclip',
  )
}

async function saveClipboardImageWindows(outputPath: string): Promise<void> {
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($img -eq $null) {
      Write-Error "No image in clipboard"
      exit 1
    }
    $img.Save("${outputPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
  `

  try {
    await execAsync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"')}"`)
  }
  catch (err) {
    throw new ClipboardError(
      'No image in clipboard',
      err instanceof Error ? err : undefined,
    )
  }
}

/**
 * Save clipboard image to a temporary file.
 * @returns Path to the saved image file
 * @throws ClipboardError if no image in clipboard or operation fails
 */
export async function saveClipboardImage(): Promise<string> {
  const outputPath = generateTempFilePath()
  const platform = os.platform()

  try {
    switch (platform) {
      case 'darwin':
        await saveClipboardImageDarwin(outputPath)
        break
      case 'linux':
        await saveClipboardImageLinux(outputPath)
        break
      case 'win32':
        await saveClipboardImageWindows(outputPath)
        break
      default:
        throw new ClipboardError(`Unsupported platform: ${platform}`)
    }

    // Verify file exists and has content
    const stats = await fs.promises.stat(outputPath)
    if (stats.size === 0) {
      await fs.promises.unlink(outputPath)
      throw new ClipboardError('No image in clipboard')
    }

    return outputPath
  }
  catch (err) {
    // Clean up on error
    try {
      await fs.promises.unlink(outputPath)
    }
    catch {
      // Ignore cleanup errors
    }

    if (err instanceof ClipboardError) {
      throw err
    }
    throw new ClipboardError(
      'Failed to save clipboard image',
      err instanceof Error ? err : undefined,
    )
  }
}

/**
 * Clean up a temporary clipboard image file.
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  }
  catch {
    // Ignore cleanup errors
  }
}
