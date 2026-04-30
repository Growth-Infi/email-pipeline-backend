import OpenAI from 'openai';
import "dotenv/config"

// const fathomApiKey = process.env.FATHOM_API_KEY
const openaiApiKey = process.env.OPENAI_API_KEY

// const trelloApiKey = process.env.TRELLO_API_KEY
// const trelloToken = process.env.TRELLO_TOKEN
// const trelloListId = process.env.TRELLO_LIST_ID

const openai = new OpenAI({
    apiKey: openaiApiKey,
});

export function compressTranscript(transcript) {
    const result = []
    let current = null

    for (const entry of transcript) {
        const speaker = entry.speaker.display_name

        if (!current || current.speaker !== speaker) {
            if (current) result.push(current)

            current = {
                speaker,
                start: entry.timestamp,
                end: entry.timestamp,
                text: entry.text
            }
        } else {
            current.text += " " + entry.text
            current.end = entry.timestamp
        }
    }

    if (current) result.push(current)

    return result
}

export function toLLMFormat(chunks) {
    return chunks.map(c => {
        if (c.start === c.end) {
            return `[${c.start}] ${c.speaker}: ${c.text}`
        }
        return `[${c.start} - ${c.end}] ${c.speaker}: ${c.text}`
    }).join("\n")
}

export async function extractTasksWithLLM(transcript) {
    const prompt = `
    You are a task extraction assistant for meeting transcripts.
    Extract ONLY clear, meaningful action items with enough context to be actionable.
    Ignore vague fragments like "do that", "this", "that thing" unless there is clear context around them.
    
    Also identify which client this meeting is about from the client list below.
    Include the client name in each task object.
 
    Client list:
    ${getClientList()}
    Return a single JSON object with:
    - "client": The client name exactly as it appears in the list above. Use "unknown" if you cannot determine with reasonable confidence.
    - "tasks": Array of task objects, each with:
    - "title": Short, action-oriented card name (max 50 chars). Start with a verb.
    - "description": Full context including who is responsible and any relevant details.
    - "due": Due date if mentioned in plain English e.g. "Friday", "next Monday". null if not mentioned.

    Rules:
    - title must be concise and scannable, it's the Trello card name
    - description should have enough context for someone who wasn't in the meeting
    - Never invent details not mentioned in the transcript
    - Return ONLY a valid JSON array of objects, no explanation, no markdown, no backticks
    - If there are no clear tasks, return { "client": "unknown", "tasks": [] }
    - dont return any other punctuation that makes it not a valid JSON array of objects, regarless of how its formatted. That means removing all unecessary "/" and "/n"

    Example output:
    {
        "client": "White Globe",
        "tasks": [
            { "title": "Send proposal to client", "description": "Palash to email the White Globe proposal including AI chatbots and LinkedIn automation", "due": "Monday" },
            { "title": "Schedule follow-up call", "description": "Set up follow-up meeting to finalize proposal details", "due": "next week" }
        ]
    }
    `
    //     For each task extract:
    // - "client": The client name exactly as it appears in the list above. Use "unknown" if you cannot determine with reasonable confidence.
    // - "title": Short, action-oriented card name (max 50 chars). Start with a verb. e.g. "Send project report to client"
    // - "description": Full context including who is responsible and any relevant details. e.g. "John to send the Q3 project report to Acme Corp by Friday EOD"
    // - "due": Due date if mentioned, in plain English e.g. "Friday", "next Monday", "end of sprint". null if not mentioned.
    //Transcript: ${transcript}
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
    console.log(response.output)
    console.log("extrating done")
    const result = response.output.filter(entry => entry.status == 'completed')
    const tasks = JSON.parse(result[0].content[0].text.trim())
    return tasks
}


// export async function fetchTranscript(transcriptId) {
//     const query = `
//         query Transcript($id: String!) {
//             transcript(id: $id) {
//                 title
//                 sentences {
//                     text
//                     speaker_name
//                 }
//             }
//         }
//     `
//     const res = await fetch("https://api.fireflies.ai/graphql", {
//         method: "POST",
//         headers: {
//             "Content-Type": "application/json",
//             "Authorization": `Bearer ${fathomApiKey}`
//         },
//         body: JSON.stringify({ query, variables: { id: transcriptId } })
//     })

//     const data = await res.json()
//     if (!data.data?.transcript?.sentences) {
//         console.log("Transcript not ready or not found:", data)
//         return null
//     }

//     const transcript = data.data.transcript.sentences.map((s) => s.text).join(" ")
//     console.log("transctipt: ", transcript)
//     return transcript
// }

// export async function createTrelloCards(tasks) {
//     for (const task of tasks) {
//         try {
//             const res = await fetch(`https://api.trello.com/1/cards?idList=${trelloListId}&key=${trelloApiKey}&token=${trelloToken}&name=${encodeURIComponent(task)}`, {
//                 method: 'POST',
//                 headers: { 'Accept': 'application/json' }
//             })
//             console.log(`Card created: ${res.status}`, task)
//         } catch (error) {
//             console.error(error)
//         }
//     }
// }

export const clients = [
    {
        name: "AskMeIdentity",
        notionPageId: "335b2b8c3b4f81a4a468eb916c346d8d",
        context: "Identity and Access Management (IAM) consulting and training company. Provides advisory, implementation, and custom software development for IAM platforms including Okta, Ping Identity, SailPoint, CyberArk, and Microsoft Entra ID. Also offers live and self-paced IAM certification courses."
    },
    {
        name: "Atom 11",
        notionPageId: "335b2b8c3b4f81d496a1e333f9a908b5",
        context: "Retail-aware Amazon PPC software based in Bangalore, India. Combines Amazon ads with inventory, pricing, Buy Box, and competition data to automate bid and budget optimization. Serves Amazon sellers, brands, and agencies. Also called Atom11."
    },
    {
        name: "Tech Sommet",
        notionPageId: "329b2b8c3b4f81f8a9e8fd2821916b29",
        context: "B2B technology events and conference company. Curates and organizes immersive tech conferences, panel discussions, workshops, and networking events for C-suite executives, thought leaders, and technology professionals across industries."
    },
    {
        name: "Lil Big Things",
        notionPageId: "325b2b8c3b4f8159a925e1a1e830b387",
        context: "Premier Webflow agency based in Bangalore, India. Designs, builds, and maintains Webflow websites for B2B SaaS startups and scaleups. Also provides branding, content, and no-code app development. Founded by Veer, also known as Little Big Things."
    },
    {
        name: "Fx31 Labs",
        notionPageId: "31eb2b8c3b4f8141a7a5ed48e295619c",
        context: "Offshore software development and IT outsourcing company based in Ahmedabad, India. Formerly Fractal31. Specializes in AI-powered solutions, Generative AI MVPs, mobile and web app development, IT staff augmentation, and remote CTO services for fintech and commerce tech companies."
    },
    {
        name: "V3 Staffing",
        notionPageId: "306b2b8c3b4f81e3b2e9ee7f8614525b",
        context: "Global IT staffing and recruitment company based in India, helps businesses hire tech talent across India, US, and UAE. Services include permanent recruitment, contract staffing, RPO, and leadership hiring for enterprises and GCCs."
    },
    {
        name: "Scaling Up",
        notionPageId: "306b2b8c3b4f81f29089f0c56f0cd504",
        context: "Business coaching and methodology company based on Verne Harnish's Scaling Up framework. Helps CEOs and leadership teams grow companies using the Four Decisions methodology covering People, Strategy, Execution, and Cash."
    },
    {
        name: "Aykan",
        notionPageId: "2fcb2b8c3b4f81079491d55a01156a39",
        context: "IT services and solutions company based in Mangalore, India. Specializes in AI agent development, custom marketplace solutions, application modernization, and cloud migration. Authorized Sharetribe partner."
    },
    {
        name: "Computerport",
        notionPageId: "2f8b2b8c3b4f816fabfef007801960cf",
        context: "IT infrastructure solutions company based in Hyderabad, India. Provides managed IT services, cloud and hybrid infrastructure, cybersecurity, virtualization, mailing solutions, and backup/disaster recovery. Official Proxmox Silver Partner."
    },
    {
        name: "Testrig Technologies",
        notionPageId: "2ecb2b8c3b4f81d3998ef0834155b949",
        context: "Software QA and testing company based in Pune, India. Provides independent quality assurance services including manual testing, automation testing, performance testing, and mobile app testing to clients globally including US and UK."
    },
    {
        name: "Tsaaro Consulting",
        notionPageId: "2d1b2b8c3b4f8111a300c00edd4c3695",
        context: "India's leading data privacy and cybersecurity consulting firm based in Noida and Bangalore. Provides GDPR, DPDPA, and HIPAA compliance, privacy assessments, ISO 27001 certifications, DPO-as-a-Service, and cybersecurity services. Clients include Adani, Flipkart, CRED, and Kotak Mahindra."
    },
    {
        name: "Aicera",
        notionPageId: "2dfb2b8c3b4f812d830dd637db1513bc",
        context: "IT services company based in Bangalore, India. Provides cloud computing, cybersecurity, and digital transformation services. Focuses on combining AI-powered strategies with human expertise for IT outcomes."
    },
    {
        name: "Connate People Technology LLP",
        notionPageId: "2c6b2b8c3b4f81cab0c6c8da407059d7",
        context: "IT services and consulting firm based in Navi Mumbai, India. Specializes in Oracle technologies, enterprise application development, business intelligence, cloud solutions, and IT consulting. Also known as Connate People."
    },
    {
        name: "White Globe",
        notionPageId: "2c0b2b8c3b4f817fb96bec3581c1ec40",
        context: "Asia's leading translation and localization company based in Pune, India. Provides translation, localization, interpretation, multimedia, e-learning, and content services in 350+ languages across 40+ industries. Serves 2000+ corporate clients globally."
    },
    {
        name: "TechEnhance",
        notionPageId: "2afb2b8c3b4f81dcb171c80ccbae2271",
        context: "IT services company based in Bangalore, India. Provides cloud consulting, AI development, DevOps, mobile app development, data engineering, managed IT, and virtual CTO services. Led by founder Ankit Tayal."
    },
    {
        name: "BDT",
        notionPageId: "2b0b2b8c3b4f81c1a687f719de86ca48",
        context: "Big Data Trunk — a data and analytics consulting and training firm founded by industry veterans. Provides strategy consulting, advisory consulting, and corporate/individual training in big data, cloud, open source, and advanced analytics."
    },
    {
        name: "Zenconnex",
        notionPageId: "2b0b2b8c3b4f80fb8953dfd011f3a40a",
        context: "Fully managed 24/7 customer support outsourcing company with 200+ CX experts. Helps businesses scale, optimize, and elevate customer satisfaction through customized managed support services."
    },
    {
        name: "SEOkart",
        notionPageId: "2c0b2b8c3b4f805ab9d9fce396670061",
        context: "E-commerce SEO agency and platform based in Jaipur, India. Provides managed SEO services and a DIY SEO app for Shopify and BigCommerce stores. Services include keyword research, technical SEO, on-page optimization, backlink building, and content marketing."
    },
]

export function getClientList() {
    return clients.map(c => `- ${c.name}: ${c.context}`).join("\n")
}

export function findClient(name) {
    const unknown = {
        name: "unknown",
        notionPageId: "352b2b8c3b4f80e8b735c0d9aef8d3e5"
    }
    return clients.find(c => c.name.toLowerCase() === name.toLowerCase()) || unknown
}



