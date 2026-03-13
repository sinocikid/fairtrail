import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';

interface AppProps {
  mode: 'search' | 'list' | 'view';
  viewId?: string;
}

export function App({ mode, viewId }: AppProps) {
  const { exit } = useApp();
  const isTTY = process.stdin.isTTY ?? false;

  useInput((input, key) => {
    if (input === 'q' && !key.ctrl) {
      exit();
    }
  }, { isActive: isTTY });

  return (
    <Box flexDirection="column">
      <Header />
      <Box flexDirection="column" paddingX={1}>
        {mode === 'search' && <Text>Search wizard — coming in Phase 3</Text>}
        {mode === 'list' && <Text>Query list — coming in Phase 4</Text>}
        {mode === 'view' && <Text>Chart view for {viewId} — coming in Phase 5</Text>}
      </Box>
      <StatusBar />
    </Box>
  );
}
