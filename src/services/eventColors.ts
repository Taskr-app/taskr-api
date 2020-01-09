export const eventColors = (
  event: 'add' | 'addDir' | 'change' | 'unlink' | 'unlinkDir'
) => {
  const eventToColors = {
    add: '\x1b[32m%s\x1b[0m',
    addDir: '\x1b[32m%s\x1b[0m',
    change: '\x1b[35m%s\x1b[0m',
    unlink: '\x1b[31m%s\x1b[0m',
    unlinkDir: '\x1b[31m%s\x1b[0m'
  }

  return eventToColors[event] || ''
};
