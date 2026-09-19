import { getUmaQuote as getUmaQuoteCore, umaQuotes } from '../quote/umaQuote.js';

export const pickRandom = arr => arr[Math.floor(Math.random() * arr.length)];

export const botQuotes = umaQuotes.map(q => q.quote);

export const getBotQuote = () => {
	return getUmaQuoteCore();
};

export const getUmaQuote = getBotQuote;
export { getUmaQuoteCore, umaQuotes };
