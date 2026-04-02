import { Router } from "express";
import { Fathom } from 'fathom-typescript';
import { getFathomClient, getTokens, saveTokens } from "../store/fathomStore.js";

const router = Router()

const clientId = process.env.FATHOM_CLIENT_ID
const clientSecret = process.env.FATHOM_CLIENT_SECRET
const redirectUri = process.env.FATHOM_REDIRECT_URL

router.get("/fathom/Oauth", async (req, res) => {
    const url = Fathom.getAuthorizationUrl({
        clientId,
        clientSecret,
        redirectUri,
        scope: 'public_api',
        state: 'randomState123',
    });
    return res.status(200).json({ url })
})

router.get('/fathom/callback', async (req, res) => {
    const { code, state } = req.query;
    // const { userId = 1 } = req.user
    const userId = 1;
    if (!code || typeof code !== 'string') {
        return res.status(400).json({ message: 'Authorization code required' });
    }

    try {
        const tokenStore = Fathom.newTokenStore();
        const fathom = new Fathom({
            security: Fathom.withAuthorization({
                clientId,
                clientSecret,
                code,
                redirectUri,
                tokenStore
            }),
        });

        // Test the connection
        const meetings = await fathom.listMeetings({});
        saveTokens(userId, tokenStore)
        return res.status(200).json({ success: true })
    } catch (error) {
        console.error('OAuth error:', error);
        return res.status(500).send('OAuth authentication failed');
    }
});

//get meeting 
router.get("/fathom/meetings", async (req, res) => {
    // const { userId } = req.user
    const userId = 1
    const fathom = getFathomClient(userId)

    const result = await fathom.listMeetings({
    });

    return res.status(200).json({ result })
})

//get transcipt
router.get("/fathom/meetings/:recordingId/transcript", async (req, res) => {
    // const { userId } = req.user
    const userId = 1
    const { recordingId } = req.params
    const tokens = getTokens(userId)  // get their stored token

    const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`, {
        headers: {
            "Authorization": `Bearer ${tokens.accessToken}`  // OAuth bearer token
        }
    })

    const data = await response.json()
    return res.status(200).json({ data })
})

export default router;