<p align="center">
  <img src="public/noderBG.png" alt="noder logo" width="120" />
</p>

<h1 align="center">noder</h1>

<p align="center">
  <strong>A node-based creative workflow canvas for chaining AI calls</strong>
</p>

<p align="center">
  <a href="#features">Features</a> -•-
  <a href="#installation">Installation</a> -•-
  <a href="#quick-start">Quick Start</a> -•-
  <a href="#documentation">Documentation</a> -•-
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-purple" alt="License: MIT" />
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-orange" alt="Platform: Windows | macOS" />
  <img src="https://img.shields.io/badge/PRs-Welcome-pink" alt="PRs Welcome" />
</p>

---

## Overview

**noder** is an open-source, local-first desktop application for building AI-powered creative workflows using a visual node-based interface. Connect text, image, video, and audio generation nodes to create complex pipelines—all running on your machine with your own API keys.

Built with [React Flow](https://reactflow.dev/) and [Tauri](https://tauri.app/), noder provides a fast, native experience while keeping your data and credentials secure on your local machine.

---

## Features

- **Visual Workflow Editor** - Drag-and-drop nodes, connect them visually, and watch your workflow execute in real-time
- **Multi-Modal AI Generation** - Text, image, video, and audio generation via Replicate API
- **Image Upscaling** - Built-in upscaler node for enhancing generated images
- **Output Gallery** - Browse, compare, and manage all your generated outputs with side-by-side comparison view
- **Workflow Templates** - Start quickly with pre-built templates for common use cases
- **Local-First Architecture** - All workflows, settings, and API keys stay on your machine
- **Keyboard Shortcuts** - Power-user features including copy/paste nodes, duplicate, and more
- **Dark/Light Themes** - Comfortable editing in any lighting condition
- **Cross-Platform** - Native apps for Windows and macOS (signed & notarized)

---

## Installation

### Download Pre-built Binary

Download the latest release from the [Releases](https://github.com/oshtz/noder/releases) page:

| Platform | Download | Description |
|----------|----------|-------------|
| Windows (Zip) | `noder-win.zip` | Recommended - extract and run |
| Windows (Portable) | `noder-portable.exe` | Single-file executable |
| macOS (DMG) | `noder_x.x.x_x64.dmg` | Installer |
| macOS (App Bundle) | `noder.app.zip` | Direct app bundle |

**Windows:** Extract `noder-win.zip` and run `noder.exe`. No installation required.

**macOS:** Download the DMG, open it, and drag noder to your Applications folder. The app is signed and notarized for Gatekeeper.

> **Note for Windows Portable Users:** The portable executable (`noder-portable.exe`) may trigger a false positive in Windows Defender (Win32/Wacatac.B!ml). This is caused by [Enigma Virtual Box](https://enigmaprotector.com/en/aboutvb.html), the tool used to package the app into a single file. The virtualization techniques it uses are similar to patterns flagged by antivirus heuristics. **This is a false positive and can be safely ignored.** If you prefer to avoid the warning, use `noder-win.zip` instead.

### Build from Source

**Prerequisites:**
- [Node.js](https://nodejs.org/) 18+ and npm
- [Rust](https://rustup.rs/) (latest stable)

```bash
# Clone the repository
git clone https://github.com/oshtz/noder.git
cd noder

# Install dependencies
npm install

# Run in development mode
npm run start

# Or build for production
npm run tauri build
```

---

## Quick Start

1. **Launch noder** - Open the app or run `npm run start`
2. **Add your API keys** - Click the Settings icon (gear) and enter your Replicate API key
3. **Create a workflow:**
   - Double-click the canvas to open the node selector
   - Add an **Image** node
   - Enter a prompt like "A serene mountain landscape at sunset"
   - Click **Run Workflow** (or press the play button)
4. **View results** - Generated outputs appear in the node and in the Output Gallery

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Double-click` | Open node selector |
| `Delete` / `Backspace` | Delete selected nodes |
| `Ctrl+D` | Duplicate selected nodes |
| `Ctrl+C` | Copy selected nodes |
| `Ctrl+V` | Paste nodes |
| `Ctrl+G` | Group selected nodes |
| `Ctrl+Shift+G` | Ungroup selected group |
| `Ctrl+Enter` | Run workflow |

> **Note:** On macOS, use `Cmd` instead of `Ctrl`

---

## Node Types

### Generation Nodes
- **Text** - Generate text using LLMs via Replicate
- **Image** - Generate images with Stable Diffusion, FLUX, and more
- **Video** - Create videos with AI video models
- **Audio** - Generate music and sound effects

### Utility Nodes
- **Upscaler** - Enhance image resolution (2x, 4x)
- **Media** - Import local images, videos, or audio files
- **Display Text** - Show text output
- **Markdown** - Render formatted markdown

---

## Workflow Templates

noder comes with pre-built templates to help you get started:

| Category | Templates |
|----------|-----------|
| **Beginner** | Concept Art Generator, Motion Graphics Creator, Soundtrack Generator, AI Copywriter |
| **Intermediate** | A/B Style Testing, Prompt Enhancer, Generate & Upscale, Brief to Image |
| **Advanced** | Content Pipeline, Brand Asset Generator, Storyboard Generator, Launch Campaign Kit |

Access templates from the rocket icon in the sidebar.

---

## Configuration

### API Keys

noder supports the following API providers:

| Provider | Purpose | Get API Key |
|----------|---------|-------------|
| **Replicate** | Image/Video/Audio/Text generation | [replicate.com](https://replicate.com/) |
| **OpenRouter** | AI Assistant panel | [openrouter.ai](https://openrouter.ai/) |

API keys are stored securely in your local app data directory and never transmitted except to their respective APIs.

### Data Storage

All data is stored locally:
- **Workflows:** `~/.noder/workflows/` (or platform equivalent)
- **Outputs:** SQLite database in app data directory
- **Settings:** Encrypted in app data directory

---

## Development

```bash
# Install dependencies
npm install

# Start development server (Vite + Tauri)
npm run start

# Run Vite dev server only (web)
npm run dev

# Run tests
npm run test

# Build for production
npm run tauri build
```

### Project Structure

```
noder/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── nodes/              # Node type definitions
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   └── constants/          # Constants and themes
├── src-tauri/              # Rust backend (Tauri)
│   └── src/                # Rust source code
├── public/                 # Static assets
└── .github/workflows/      # CI/CD configuration
```

---

## Contributing

We welcome contributions! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- [React Flow](https://reactflow.dev/)
- [Tauri](https://tauri.app/)
- [Replicate](https://replicate.com/)