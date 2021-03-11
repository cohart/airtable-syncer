import Record from 'airtable/lib/record'
import { Airtable, airtable } from './airtableClient'
import { mailchimp, MailchimpMember } from './mailchimpClient'

main()

async function main() {
  try {
    const airtableRecords = await airtable.getAllRecords()
    const mailchimpMembers = await mailchimp.getAllMembers()

    for (const [email, record] of airtableRecords) {
      if (!mailchimpMembers.has(email)) {
        if (record.fields[Airtable.cols.addToMailchimp] === 'Yes') {
          await mailchimp.addMember(record)
        }
      } else {
        if (record.fields[Airtable.cols.addToMailchimp] === 'Yes') {
          await record.patchUpdate({ [Airtable.cols.addToMailchimp]: null })
        }
        await sync(record, mailchimpMembers.get(email)!)
      }
    }

    for (const [email, mailchimpMember] of mailchimpMembers) {
      if (!airtableRecords.has(email)) {
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
    console.log(`syncing name to '${mailchimpName}'`)
    await airtableRecord.patchUpdate({ [Airtable.cols.name]: mailchimpName })
  } else if (airtableName && airtableName !== '') {
    const name = mailchimp.separateName(airtableName)
    console.log(`syncing name to ${name[0]} ${name[1]}`)
    await mailchimp.updateName(mailchimpMember, name[0], name[1])
  }
}
