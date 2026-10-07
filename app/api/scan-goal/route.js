import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return Response.json(
        { error: 'No goal form image was provided.' },
        { status: 400 }
      )
    }

    if (!file.type?.startsWith('image/')) {
      return Response.json(
        { error: 'Please upload an image file.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const imageUrl = `data:${file.type};base64,${base64}`

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
Extract the goal and STO information from this special education or therapy goal form.

Return JSON only.

Do not invent missing information.

Use this structure:

{
  "goal": {
    "title": "",
    "area": "",
    "direction": "up",
    "measureType": "",
    "target": null,
    "totalTrials": null,
    "baseline": null,
    "baselineTotalTrials": null,
    "unit": "",
    "supports": "",
    "targetDate": null
  },
  "stos": [
    {
      "title": "",
      "measurementType": "",
      "baseline": null,
      "baselineTotalTrials": null,
      "target": null,
      "targetTotalTrials": null,
      "unit": "",
      "targetDate": null,
      "supports": ""
    }
  ]
}

Allowed measurement types:
count
percentage
trials
duration
frequency
prompt

Rules:

- "4 of 5 opportunities" means:
  measureType = "trials"
  target = 4
  totalTrials = 5

- "2 of 5 opportunities" as a baseline means:
  baseline = 2
  baselineTotalTrials = 5

- Preserve the original goal wording when possible.

- Put prompts, cues, assistance, accommodations, or supports in "supports".

- Do not return student name, date of birth, student ID, address, or other identifying information.

- Use null or an empty string when something cannot be determined.
              `
            },
            {
              type: 'input_image',
              image_url: imageUrl,
              detail: 'high'
            }
          ]
        }
      ]
    })

    const extracted = JSON.parse(response.output_text)

    return Response.json(extracted)
  } catch (error) {
    console.error('Goal scan error:', error)

    return Response.json(
      { error: error?.message || 'Goal form could not be analyzed.' },
      { status: 500 }
    )
  }
}