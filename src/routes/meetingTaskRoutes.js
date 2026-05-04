import { Router } from "express";
import { Fathom } from 'fathom-typescript';
import { Client } from "@notionhq/client"

import { getFathomClient, getTokens, saveTokens } from "../store/fathomStore.js";
import { compressTranscript, extractTasksWithLLM, findClient, toLLMFormat } from "../services/meetingTaskService.js";

const router = Router()


//get meeting 
router.get("/fathom/meetings", async (req, res) => {
    // const { userId } = req.user
    // const fathom = getFathomClient(userId)
    // const result = await fathom.listMeetings({
    // });
    const { cursor } = req.query
    try {
        const url = new URL("https://api.fathom.ai/external/v1/meetings?calendar_invitees_domains_type=all&include_action_items=true")
        if (cursor) url.searchParams.set("cursor", cursor)
        let data = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'X-Api-Key': `${process.env.FATHOM_API_KEY}`
            }
        })
        data = await data.json()
        const result = (data.items || []).map(meeting => ({
            recording_id: meeting.recording_id,
            title: meeting.title,
            created_at: meeting.created_at,
            action_items: meeting.action_items
        }))

        return res.status(200).json({ result, nextCursor: data.next_cursor || null, version: "v2", })
    } catch (error) {
        console.error(error)
        return res.status(500).json({ message: "Failed to fetch meetings" })
    }
})

//get transcipt
router.get("/fathom/meetings/:recordingId/tasks", async (req, res) => {
    // const { userId } = req.user
    const { title = null } = req.query
    const { recordingId } = req.params
    // const tokens = getTokens(userId)  // get their stored token
    const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`, {
        method: 'GET',
        headers: {
            'X-Api-Key': `${process.env.FATHOM_API_KEY}`
        }
    })
    const data = await response.json()
    const compressedTranscript = compressTranscript(data.transcript)
    const formattedTranscript = toLLMFormat(compressedTranscript)
    const transcriptWithTitle = title ? `Meeting Title: ${title}\n${formattedTranscript}` : `${formattedTranscript}`
    const actionItems = await extractTasksWithLLM(transcriptWithTitle)

    return res.status(200).json({ actionItems })
})

router.get("/fathom/meetings/:recordingId/summary", async (req, res) => {
    const { recordingId } = req.params
    const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`, {
        method: 'GET',
        headers: {
            'X-Api-Key': `${process.env.FATHOM_API_KEY}`
        }
    })
    const data = await response.json()
    console.log("response", response)
    console.log("response.json()", data)
    return res.status(200).json({ data })
})

//      NOTION STUFF

const notion = new Client({ auth: process.env.NOTION_API_KEY })

const growthinfi_pageId = "34ab2b8c-3b4f-804b-9c20-d3cf886162d5"
const personal_pageId = "34f15e90-98fe-8049-a4a2-c2604fd3c198"

router.post("/notion/createPage", async (req, res) => {
    const { title, actionItems } = req.body
    try {
        const client = findClient(actionItems.client)
        const targetPageId = client?.notionPageId || personal_pageId
        // client.notionPageId
        console.log(client)
        const response = await notion.pages.create({
            parent: {
                page_id: targetPageId
            },
            properties: {
                title: [
                    { text: { content: title } }
                ]
            },
            children: actionItems.tasks.flatMap(item => ([
                {
                    object: "block",
                    type: "to_do",
                    to_do: {
                        rich_text: [{ type: "text", text: { content: item.title } }],
                        checked: false
                    }
                },
                ...(item.description ? [{
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                        rich_text: [{ type: "text", text: { content: item.description }, annotations: { color: "gray" } }]
                    }
                }] : [])
            ]))
        })
        return res.status(200).json({ success: true, pageId: response.id })
    } catch (error) {
        console.log("Notion error", error)
        return res.status(500).json({ message: "Failed to create Notion page" })
    }

})


//      TRELLO STUFF

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

