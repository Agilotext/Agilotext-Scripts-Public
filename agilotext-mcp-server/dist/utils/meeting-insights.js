/**
 * Meeting insights extraction utility
 * Extracted from index.ts to eliminate code duplication
 */
/**
 * Extracts meeting insights from transcript text
 */
export function deriveMeetingInsightsFromText(content) {
    const lines = content.split("\n");
    const actionPatterns = /\b(action|todo|à faire|doit|devra|faut|need to|will|should|must)\b/i;
    const questionPatterns = /\?|\b(qu'est-ce|comment|pourquoi|quand|où|qui|combien|what|how|why|when|where|who)\b/i;
    const decisionPatterns = /\b(décidé|décision|on fait|we decided|agreed|validé|approuvé|confirmed)\b/i;
    const actionItems = [];
    const questions = [];
    const decisions = [];
    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.length > 20 && trimmed.length < 300) {
            if (actionPatterns.test(trimmed))
                actionItems.push(trimmed);
            if (questionPatterns.test(trimmed))
                questions.push(trimmed);
            if (decisionPatterns.test(trimmed))
                decisions.push(trimmed);
        }
    });
    const speakerPattern = /^(Speaker \d+|Intervenant \d+|[A-Z][a-z]+ [A-Z][a-z]+):/gm;
    const speakers = [...new Set(content.match(speakerPattern) || [])];
    const words = content.toLowerCase().split(/\s+/);
    const wordFreq = {};
    const stopWords = new Set([
        "le",
        "la",
        "les",
        "de",
        "du",
        "des",
        "un",
        "une",
        "et",
        "ou",
        "a",
        "à",
        "the",
        "is",
        "are",
        "was",
        "were",
        "and",
        "or",
        "but",
        "in",
        "on",
        "at",
        "to",
        "for",
    ]);
    words.forEach((w) => {
        if (w.length > 4 && !stopWords.has(w)) {
            wordFreq[w] = (wordFreq[w] || 0) + 1;
        }
    });
    const topTopics = Object.entries(wordFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([word, count]) => ({ word, count }));
    return {
        speakers: speakers.slice(0, 10),
        speakerCount: speakers.length,
        insights: {
            actionItems: actionItems.slice(0, 10),
            questions: questions.slice(0, 10),
            decisions: decisions.slice(0, 10),
        },
        topTopics,
        stats: {
            totalWords: words.length,
            totalLines: lines.length,
            estimatedDuration: String(Math.round(words.length / 150)) + " minutes",
        },
    };
}
