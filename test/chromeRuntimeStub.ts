// Stand-in for chrome.runtime.sendMessage, for tests only. A test decides what
// the worker answers — including answering nothing, which is exactly what a
// dead worker looks like from the panel.

export interface ChromeRuntimeStub {
  sendMessage(message: unknown): Promise<unknown>;
  reply(answer: unknown): void;
  sent: unknown[];
}

export function createChromeRuntimeStub(): ChromeRuntimeStub {
  let answer: unknown = undefined;
  const sent: unknown[] = [];

  return {
    sent,
    reply(next) {
      answer = next;
    },
    async sendMessage(message) {
      sent.push(message);
      return answer;
    },
  };
}
