import AirtableClient from 'airtable'
import Record from 'airtable/lib/record'
import { mailchimp, MailchimpMember } from './mailchimpClient'
import dotenv from 'dotenv'

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const airtableBase = new AirtableClient({ apiKey: process.env.AIRTABLE_API_KEY }).base('appfk7VT7P96TwWdg')

export class Airtable {
  static cols = {
    email: 'Email',
    name: 'Name (used in emails)',
    tags: '🔒 Mailchimp tags',
    status: '🔒 Mailchimp status',
    addToMailchimp: 'Add to mailchimp?',
    lastModified: '🔒 Last Modified',
    alphaSurvey: '🔒 Alpha survey',
  }

  async addSurveyResultRow(name: string, email: string, results: string) {
    return airtableBase('Art World').create({
      [Airtable.cols.name]: name,
      [Airtable.cols.email]: email,
      [Airtable.cols.alphaSurvey]: results,
      [Airtable.cols.addToMailchimp]: 'Yes',
    })
  }

  async getAllRecords(): Promise<Map<string, Record>> {
    return new Promise((resolve, reject) => {
      const allRecords: Record[] = []

      airtableBase('Art World')
        .select()
        .eachPage(
          (records, fetchNextPage) => {
            allRecords.push(...records)
            fetchNextPage()
          },
          (err: any) => {
            if (err) {
              reject(err)
            }
            resolve(
              new Map(
                allRecords
                  .filter(r => !!r.fields[Airtable.cols.email])
                  .map(r => [r.fields[Airtable.cols.email].trim().toLowerCase(), r])
              )
            )
          }
        )
    })
  }

  async addRecord(mailchimpMember: MailchimpMember) {
    console.log(`adding member ${mailchimpMember.id} to airtable`)

    return airtableBase('Art World').create({
      [Airtable.cols.name]: mailchimp.getNameFromMember(mailchimpMember),
      [Airtable.cols.email]: mailchimpMember.email_address,
      [Airtable.cols.tags]: mailchimp.getTagsFromMember(mailchimpMember),
      [Airtable.cols.status]: mailchimpMember.status,
    })
  }

  async updateRecordExceptName(airtableRecord: Record, mailchimpMember: MailchimpMember) {
    if (
      airtableRecord.fields[Airtable.cols.status] === mailchimpMember.status &&
      arrayEquals(airtableRecord.fields[Airtable.cols.tags] || [], mailchimp.getTagsFromMember(mailchimpMember))
    ) {
      return
    }
    console.log(`updating record ${airtableRecord.id} in airtable`)
    console.log({
      [Airtable.cols.status]: mailchimpMember.status,
      [Airtable.cols.tags]: mailchimp.getTagsFromMember(mailchimpMember),
    })
    return airtableRecord.patchUpdate({
      [Airtable.cols.status]: mailchimpMember.status,
      [Airtable.cols.tags]: mailchimp.getTagsFromMember(mailchimpMember),
    })
  }
}

export const airtable = new Airtable()

function arrayEquals(a: string[], b: string[]) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
