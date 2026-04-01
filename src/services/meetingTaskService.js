import OpenAI from 'openai';
import "dotenv/config"

const fathomApiKey = process.env.FATHOM_API_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

const trelloApiKey = process.env.TRELLO_API_KEY
const trelloToken = process.env.TRELLO_TOKEN
const trelloListId = process.env.TRELLO_LIST_ID

const openai = new OpenAI({
    apiKey: config.genaiApiKey,
});

export async function fetchTranscript(transcriptId) {
    const query = `
        query Transcript($id: String!) {
            transcript(id: $id) {
                title
                sentences {
                    text
                    speaker_name
                }
            }
        }
    `
    const res = await fetch("https://api.fireflies.ai/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${firefliesApiKey}`
        },
        body: JSON.stringify({ query, variables: { id: transcriptId } })
    })

    const data = await res.json()
    if (!data.data?.transcript?.sentences) {
        console.log("Transcript not ready or not found:", data)
        return null
    }

    const transcript = data.data.transcript.sentences.map((s) => s.text).join(" ")
    console.log("transctipt: ", transcript)
    return transcript
}

export async function extractTasksWithLLM(transcript) {
    const prompt = `
    You are a task extraction assistant for meeting transcripts.
    Extract ONLY clear, meaningful action items with enough context to be actionable.
    Ignore vague fragments like "do that", "this", "that thing" unless there is clear context around them.
    A valid task should have: WHO does it (if mentioned), WHAT needs to be done, and ideally WHEN.

    Return ONLY a valid JSON array of strings, no explanation, no markdown, no backticks.
    If there are no clear tasks, return an empty array: []

    Example output: ["John to send project report by Friday", "Set up the database before next sprint", "Schedule follow up meeting"]

    `
    // Transcript: ${transcript}
    let response
    try {
        response = await openai.responses.create({
            model: 'gpt-5-mini',
            instructions: prompt,
            input: `Transcript: ${transcript}`,
        });

    } catch (error) {
        console.error("Extracting error: ", error)
        throw error
    }

    console.log("extrating done")
    return JSON.parse(response.output)
}

export async function createTrelloCards(tasks) {
    for (const task of tasks) {
        try {
            const res = await fetch(`https://api.trello.com/1/cards?idList=${trelloListId}&key=${trelloApiKey}&token=${trelloToken}&name=${encodeURIComponent(task)}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' }
            })
            console.log(`Card created: ${res.status}`, task)
        } catch (error) {
            console.error(error)
        }
    }
}