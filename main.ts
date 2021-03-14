import Record from 'airtable/lib/record'
import { Airtable, airtable } from './airtableClient'
import { mailchimp, MailchimpMember } from './mailchimpClient'

/**
 * This repo is for syncing Cohart's airtable and mailchimp.
 * Things to note:
 * - emails are usually not case-sensitive, but *can* be,
 * so we want to preserve the casing people write their emails in.
 * But, we want to case-insensitively compare emails when we're looking for
 * a match between airtable and mailchimp.
 * So, both the airtableClient and mailchimpClient convert all the emails
 * to lowercase in the maps they return.
 */

main()

async function main() {
  try {
    const airtableRecords = await airtable.getAllRecords()
    const mailchimpMembers = await mailchimp.getAllMembers()

    console.log(`Got ${airtableRecords.size} total records from airtable`)
    console.log(`Got ${mailchimpMembers.size} total members from mailchimp`)

    if (airtableRecords.size < 100) {
      throw new Error(`Only got ${airtableRecords.size} total records from airtable`)
    }
    if (mailchimpMembers.size < 100) {
      throw new Error(`Only got ${mailchimpMembers.size} total members from mailchimp`)
    }

    for (const [lowerCaseEmail, record] of airtableRecords) {
      if (!mailchimpMembers.has(lowerCaseEmail)) {
        if (record.fields[Airtable.cols.addToMailchimp] === 'Yes') {
          await mailchimp.addMember(record)
        }
      } else {
        await sync(record, mailchimpMembers.get(lowerCaseEmail)!)
      }
    }

    for (const [lowerCaseEmail, mailchimpMember] of mailchimpMembers) {
      if (
        !airtableRecords.has(lowerCaseEmail) &&
        mailchimpMember.status !== 'cleaned' &&
        mailchimpMember.status !== 'archived'
      ) {
        await airtable.addRecord(mailchimpMember)
      }
    }
  } catch (e) {
    console.log(e)
    throw e
  }
}

async function sync(airtableRecord: Record, mailchimpMember: MailchimpMember) {
  await syncName(airtableRecord, mailchimpMember)
  await airtable.updateRecordExceptName(airtableRecord, mailchimpMember)
}

async function syncName(airtableRecord: Record, mailchimpMember: MailchimpMember) {
  const airtableName = airtableRecord.fields[Airtable.cols.name]
  const mailchimpName = mailchimp.getNameFromMember(mailchimpMember)
  if (airtableName === mailchimpName) {
    return
  }

  if ((!airtableName || airtableName === '') && mailchimpName !== '') {
    await airtableRecord.patchUpdate({ [Airtable.cols.name]: mailchimpName })
  } else if (airtableName && airtableName !== '') {
    const name = mailchimp.separateName(airtableName)
    await mailchimp.updateName(mailchimpMember, name[0], name[1])
  }
}
