import { DynamoDB as DynamoDBConn } from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'
import { Airtable, airtable } from './airtableClient'

/**
 * This file is not used as part of the normal syncing process,
 * But it was used for backfilling existing survey data from dynamodb to airtable.
 */

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const surveys = {
  // Fill with emails and names of people to query survey results for
  'email@example.com': 'Monalisa',
}

const db = new DynamoDBConn({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_ACCESS_SECRET!,
  },
})

class DynamoDB {
  static surveyResultKeyMap = {
    selfDefinition: 'How do you define yourself?',
    whereArt: 'Where do you love to explore art and culture?',
    currentShowcase: 'How do you showcase your artwork or collections now?',
    excitement: 'What most excites you about Cohart?',
    howCanWeHelp: 'How can we improve your art experience?',
    involvement: 'How do you want to be involved?',
    location: 'Where are you based?',
  }

  async getSurveyResponse(email: string): Promise<SurveyResults | null> {
    const { Item } = await db.getItem({ TableName: 'SurveyResponses', Key: { Email: { S: email } } })
    if (!Item) {
      return null
    }
    return {
      selfDefinition: Item.SelfDefinition?.SS,
      excitement: Item.Excitement?.SS,
      howCanWeHelp: Item.HowCanWeHelp?.SS,
      location: Item.Location?.S,
      whereArt: Item.WhereArt?.SS,
      involvement: Item.Involvement?.S,
      currentShowcase: Item.CurrentShowcase?.SS,
      name: Item.Email?.S,
    }
  }

  formatSurveyResults(surveyResults: SurveyResults) {
    const format = (val: any) => {
      if (Array.isArray(val)) {
        return '{' + val.map(x => `'${x}'`).join(', ') + '}'
      } else {
        return val
      }
    }

    let response = ''
    for (const key in surveyResults) {
      if (surveyResults[key] && DynamoDB.surveyResultKeyMap[key]) {
        response += DynamoDB.surveyResultKeyMap[key] + ' ' + format(surveyResults[key]) + '\n'
      }
    }
    return response
  }
}

export const dynamodb = new DynamoDB()

export interface SurveyResults {
  selfDefinition: string[] | undefined
  excitement: string[] | undefined
  howCanWeHelp: string[] | undefined
  location: string | undefined
  whereArt: string[] | undefined
  involvement: string | undefined
  currentShowcase: string[] | undefined
  name: string | undefined
}

async function backfill() {
  const allRecords = await airtable.getAllRecords()
  for (let email in surveys) {
    const name = surveys[email]
    const dbRow = await dynamodb.getSurveyResponse(email)
    if (!dbRow) {
      throw new Error("Couldn't find survey results")
    }
    const formattedResults = dynamodb.formatSurveyResults(dbRow)
    if (!allRecords.has(email.toLowerCase())) {
      console.log('adding row for ', name, email)
      airtable.addSurveyResultRow(name, email, formattedResults)
    } else {
      console.log('updating row for ', name, email)
      allRecords.get(email.toLowerCase())!.patchUpdate({
        [Airtable.cols.name]: name,
        [Airtable.cols.email]: email,
        [Airtable.cols.alphaSurvey]: formattedResults,
        [Airtable.cols.addToMailchimp]: 'Yes',
      })
    }
  }
}

backfill()
