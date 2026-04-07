import { Router } from "express";
import { Fathom } from 'fathom-typescript';
import { getFathomClient, getTokens, saveTokens } from "../store/fathomStore.js";

const router = Router()


//get meeting 
router.get("/fathom/meetings", async (req, res) => {
    // const { userId } = req.user
    // const fathom = getFathomClient(userId)
    // const result = await fathom.listMeetings({
    // });
    let result
    try {
        result = await fetch("https://api.fathom.ai/external/v1/meetings?calendar_invitees_domains_type=all&include_action_items=true", {
            method: 'GET',
            headers: {
                'X-Api-Key': `${process.env.FATHOM_API_KEY}`
            }
        })
        result = await result.json()
        result = result.items.map(meeting => ({
            recording_id: meeting.recording_id,
            title: meeting.title,
            created_at: meeting.created_at,
            action_items: meeting.action_items
        }))
    } catch (error) {
        throw error
    }
    return res.status(200).json({ result })
})



const trelloKey = process.env.TRELLO_KEY
const trelloToken = process.env.TRELLO_TOKEN
const trelloBase = "https://api.trello.com/1"

// get all boards
router.get("/trello/boards", async (req, res) => {
    try {
        const response = await fetch(`${trelloBase}/members/me/boards?key=${trelloKey}&token=${trelloToken}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })
        const data = await response.json()

        // slim it down, frontend only needs id and name
        const boards = data.map(board => ({
            id: board.id,
            name: board.name
        }))

        return res.status(200).json({ boards })
    } catch (error) {
        console.error("Error fetching boards:", error)
        return res.status(500).json({ message: "Failed to fetch boards" })
    }
})

// get lists for a board
router.get("/trello/boards/:boardId/lists", async (req, res) => {
    const { boardId } = req.params
    try {
        const response = await fetch(`${trelloBase}/boards/${boardId}/lists?key=${trelloKey}&token=${trelloToken}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        })
        const data = await response.json()

        const lists = data.map(list => ({
            id: list.id,
            name: list.name
        }))

        return res.status(200).json({ lists })
    } catch (error) {
        console.error("Error fetching lists:", error)
        return res.status(500).json({ message: "Failed to fetch lists" })
    }
})

// create cards from action items
router.post("/trello/cards", async (req, res) => {
    const { listId, actionItems } = req.body

    if (!listId || !actionItems?.length) {
        return res.status(400).json({ message: "listId and actionItems are required" })
    }

    try {
        const results = await Promise.all(
            actionItems.map(item =>
                fetch(`${trelloBase}/cards?key=${trelloKey}&token=${trelloToken}&idList=${listId}&name=${encodeURIComponent(item.description)}`, {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' }
                }).then(res => res.json())
            )
        )

        return res.status(200).json({ created: results.length, cards: results })
    } catch (error) {
        console.error("Error creating cards:", error)
        return res.status(500).json({ message: "Failed to create cards" })
    }
})
export default router;

// for future updates

// router.get("/fathom/Oauth", async (req, res) => {
//     const url = Fathom.getAuthorizationUrl({
//         clientId,
//         clientSecret,
//         redirectUri,
//         scope: 'public_api',
//         state: 'randomState123',
//     });
//     return res.status(200).json({ url })
// })

// router.get('/fathom/callback', async (req, res) => {
//     const { code, state } = req.query;
//     // const { userId = 1 } = req.user
//     const userId = 1;
//     if (!code || typeof code !== 'string') {
//         return res.status(400).json({ message: 'Authorization code required' });
//     }

//     try {
//         const tokenStore = Fathom.newTokenStore();
//         const fathom = new Fathom({
//             security: Fathom.withAuthorization({
//                 clientId,
//                 clientSecret,
//                 code,
//                 redirectUri,
//                 tokenStore
//             }),
//         });

//         // Test the connection
//         const meetings = await fathom.listMeetings({});
//         saveTokens(userId, tokenStore)
//         return res.status(200).json({ success: true })
//     } catch (error) {
//         console.error('OAuth error:', error);
//         return res.status(500).send('OAuth authentication failed');
//     }
// });

// //get transcipt
// router.get("/fathom/meetings/:recordingId/transcript", async (req, res) => {
//     // const { userId } = req.user
//     const { recordingId } = req.params
//     // const tokens = getTokens(userId)  // get their stored token
//     const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`, {
//         method: 'GET',
//         headers: {
//             'X-Api-Key': `${process.env.FATHOM_API_KEY}`
//         }
//     })
//     console.log(response)
//     const data = await response.json()
//     return res.status(200).json({ data })
// })

// router.get("/fathom/meetings/:recordingId/summary", async (req, res) => {
//     const { recordingId } = req.params
//     const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`, {
//         method: 'GET',
//         headers: {
//             'X-Api-Key': `${process.env.FATHOM_API_KEY}`
//         }
//     })
//     console.log(response)
//     const data = await response.json()
//     return res.status(200).json({ data })

// })