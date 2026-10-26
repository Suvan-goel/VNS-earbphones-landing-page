/** Keep the animated mannequin story and the stacked fallback in sync. */
export const productStory = {
  work: {
    headline: ["For your most", "demanding work."] as [string, string],
    examples: [
      "For the code you’re untangling.",
      "The paper you’re making sense of.",
      "The idea you want to understand.",
    ],
  },
  technology: {
    headline: ["Premium sound", "x Neurotech"] as [string, string],
    description: "Premium audio and targeted nerve stimulation, together in one pair of earbuds.",
    steps: [
      { title: "Sense your state.", line: "EEG sensors measure brain activity. PPG sensors track your pulse." },
      { title: "Time the stimulation.", line: "The system is designed to use those signals to time stimulation at the outer ear." },
      { title: "You’re in control.", line: "Listen with stimulation off, or start a session when you choose." },
    ],
  },
};
