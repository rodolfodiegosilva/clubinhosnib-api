import { Body, Controller, Post } from '@nestjs/common';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  async create(@Body() body: {
    name: string;
    email: string;
    phone: string;
    message: string;
  }) {
    return this.contactService.createContact(body);
  }
}
