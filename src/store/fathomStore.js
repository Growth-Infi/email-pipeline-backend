import { Fathom } from 'fathom-typescript';

const tokenStore = new Map(); // replace with DB in prod

export function saveTokens(userId, tokens) {
    tokenStore.set(userId, tokens);
}

export function getTokens(userId) {
    return tokenStore.get(userId);
}

export function getFathomClient(userId) {
    const tokens = getTokens(userId);
    if (!tokens) throw new Error("No tokens found for user");

    return new Fathom({
        security: Fathom.withAuthorization({
            clientId: process.env.FATHOM_CLIENT_ID,
            clientSecret: process.env.FATHOM_CLIENT_SECRET,
            tokenStore: tokens,
            redirectUri: process.env.FATHOM_REDIRECT_URI,
        }),
    });
}