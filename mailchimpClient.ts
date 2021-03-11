import MailchimpApi from 'mailchimp-api-v3'
import crypto from 'crypto'
import { Airtable } from './airtableClient'
import Record from 'airtable/lib/record'
import dotenv from 'dotenv'

if (process.env.NODE_ENV !== 'production') {
  dotenv.config()
}

const mailchimpApi = new MailchimpApi(process.env.MAILCHIMP_API_KEY!)

class Mailchimp {
  constructor(private listId: string) {}

  async getAllMembers(): Promise<Map<string, MailchimpMember>> {
    const count = 100
    let lastBatchSize = count
    let allMembers: MailchimpMember[] = []
    for (let offset = 0; lastBatchSize >= count; offset += count) {
      const members = await this.getListMembersFromOffset(count, offset)
      allMembers = allMembers.concat(members)
      lastBatchSize = members.length
    }
    return new Map(allMembers.map(m => [m.email_address, m]))
  }

  async getListMembersFromOffset(count: number, offset: number): Promise<MailchimpMember[]> {
    const { members }: { members: MailchimpMember[] } = await mailchimpApi.get({
      path: `/lists/${this.listId}/members?offset=${offset}&count=${count}`,
    })
    return members
  }

  async addMember(record: Record) {
    console.log(`adding record ${record.id} to mailchimp`)
    const name = this.separateName(record.fields[Airtable.cols.name])
    await mailchimpApi.post(`/lists/${this.listId}/members`, {
      status: 'pending',
      email_address: record.fields[Airtable.cols.email],
      merge_fields: { FNAME: name[0], LNAME: name[1] },
      tags: record.fields[Airtable.cols.tags],
    })
  }

  async updateName(mailchimpMember: MailchimpMember, FNAME: string, LNAME: string) {
    return mailchimpApi.patch(`/lists/${this.listId}/members/${this.getMemberHash(mailchimpMember.email_address)}`, {
      merge_fields: { FNAME, LNAME },
    })
  }

  separateName(fullname: string) {
    if (!fullname) {
      fullname = ''
    }
    const parts = fullname.split(' ')
    return [parts[0], parts.slice(1).join(' ')]
  }

  getMemberHash(email: string) {
    return crypto.createHash('md5').update(email.toLowerCase()).digest('hex')
  }

  getNameFromMember(mailchimpMember: MailchimpMember) {
    let { FNAME, LNAME } = mailchimpMember.merge_fields
    if (!FNAME) {
      FNAME = ''
    }
    if (!LNAME) {
      LNAME = ''
    }
    return LNAME?.length > 0 ? `${FNAME} ${LNAME}` : FNAME
  }

  getTagsFromMember(mailchimpMember: MailchimpMember) {
    return mailchimpMember.tags.map(t => t.name)
  }
}

const cohartCommunityMailchimpListId = '85012e451a'
export const mailchimp = new Mailchimp(cohartCommunityMailchimpListId)

export interface MailchimpMember {
  id: string
  email_address: string
  unique_email_id: string
  web_id: string
  email_type: string
  status: string
  merge_fields: { [key: string]: string }
  stats: { avg_open_rate: number; avg_click_rate: 0 }
  ip_signup: string
  timestamp_signup: string
  ip_opt: string
  timestamp_opt: string
  member_rating: number
  last_changed: string
  language: string
  vip: boolean
  location: {
    latitude: number
    longitude: number
    gmtoff: number
    dstoff: number
    country_code: string
    timezone: string
  }
  source: string
  tags_count: number
  tags: { id: number; name: string }[]
  email_client: string
  list_id: string
}
