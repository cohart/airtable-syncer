import Record from 'airtable/lib/record'
import { Airtable, airtable } from './airtableClient'
import { mailchimp, MailchimpMember } from './mailchimpClient'

main()

async function main() {
  try {
    const airtableRecords = await airtable.getAllRecords()
    const mailchimpMembers = await mailchimp.getAllMembers()

    for (const [emailKey, record] of airtableRecords) {
      if (!mailchimpMembers.has(emailKey)) {
        if (record.fields[Airtable.cols.addToMailchimp] === 'Yes') {
          await mailchimp.addMember(record)
        }
      } else {
        await sync(record, mailchimpMembers.get(emailKey)!)
      }
    }

    for (const [emailKey, mailchimpMember] of mailchimpMembers) {
      if (
        !airtableRecords.has(emailKey) &&
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
