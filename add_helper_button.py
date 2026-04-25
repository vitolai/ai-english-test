import os

dashboard_path = os.path.expanduser('~/workspace/toeic-ai-pro/src/Dashboard.tsx')

with open(dashboard_path, 'r') as f:
    content = f.read()

helper_button_jsx = '''<div className=flex items-center gap-2 mt-2>
                        <button
                            onClick={() => setAiApiUrl(http://localhost:11434/v1/chat/completions)}
                            className=text-sm font-medium text-blue-600 hover:text-blue-800
                        >
                            Use Local Ollama
                        </button>
                    </div>'''

import re
pattern = r'(<div className=w-full p-4 rounded-xl border-2 border-blue-200 bg-white text-blue-950 font-mono font-bold text-sm outline-none ring-blue-50 focus:ring-4 transition-all.*?\/input>.*?<\/div>)'
replacement = f'\1{helper_button_jsx}'
content = re.sub(pattern, replacement, content, flags=re.DOTALL)

with open(dashboard_path, 'w') as f:
    f.write(content)

print("Helper button 'Use Local Ollama' added to Dashboard.")
