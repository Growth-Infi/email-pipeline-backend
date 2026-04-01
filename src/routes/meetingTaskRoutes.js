import { Router } from "express";

const app = Router()

app.post("/fireflies/webhook", async (req, res) => {
    res.status(200).json({ received: true })

    const { meetingId, eventType } = req.body
    if (eventType !== "Transcription completed") return
    try {
        const transcript = await fetchTranscript(meetingId)
        if (!transcript) return

        const tasks = await extractTasksWithLLM(transcript)
        console.log("Tasks extracted: ", tasks)

        await createTrelloCards(tasks)
        console.log(`Created ${tasks.length} Tasks`)

    } catch (error) {
        console.error("Pipeline failed:", error)
    }

})