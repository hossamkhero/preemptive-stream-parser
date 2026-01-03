import { TestPlayground } from './components/TestPlayground'

function App() {
    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                        MD Stream Parser
                    </h1>
                    <span className="text-xs text-zinc-500 font-mono">v0.1.0</span>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-6">
                <TestPlayground />
            </main>
        </div>
    )
}

export default App
