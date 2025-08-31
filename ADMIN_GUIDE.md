# Administrator Guide - Advanced Exam Application

## 🚀 Getting Started

### Initial Setup
1. **Access Admin Panel**: Navigate to `/admin/login`
2. **Default Credentials**: 
   - Username: `ehab`
   - Password: `436762`
3. **First Login**: The first authenticated user is automatically promoted to admin

### System Configuration
1. **Global Settings** (`/admin/settings`):
   - Configure branding (logo, name)
   - Set default language (Arabic/English)
   - Customize WhatsApp templates
   - Set welcome messages and instructions

## 📚 Exam Management

### Creating an Exam
1. Navigate to `/admin/exams`
2. Click "Create New Exam"
3. Fill in exam details:
   - **Title**: Exam name (supports Arabic/English)
   - **Description**: Optional exam description
   - **Access Type**: 
     - `Open`: Anyone can access
     - `Code-based`: Requires student codes
     - `IP-restricted`: Limited to specific IP ranges
   - **Scheduling**: Set start/end times
   - **Duration**: Time limit in minutes
   - **Settings**: Configure randomization, display mode, auto-save interval

### Question Management
1. Go to `/admin/exams/[examId]/questions`
2. **Add Questions**:
   - Multiple Choice (single answer)
   - Multiple Select (multiple answers)
   - True/False
   - Short Answer
   - Paragraph (long text)
3. **Bulk Import**: Upload CSV/XLSX files with questions
4. **Reorder**: Drag and drop to change question order
5. **Edit**: Modify existing questions and scoring

### Student Management
1. **Global Students** (`/admin/students`):
   - Manage the global student database
   - Generate unique 4-digit codes
   - Import students via CSV/XLSX
2. **Exam-specific Students** (`/admin/exams/[examId]/students`):
   - Assign students to specific exams
   - Send codes via WhatsApp
   - Track attempt status

## 📊 Results & Analytics

### Viewing Results
1. Navigate to `/admin/results`
2. **Filter Options**:
   - By exam
   - By student
   - By date range
   - By completion status
3. **Individual Results**: Click on any attempt for detailed view

### Analytics Dashboard
- **Question Analysis**: See which questions are most/least difficult
- **Score Distribution**: Visual charts of student performance
- **Completion Rates**: Track exam completion statistics
- **Time Analysis**: Average time spent per question/exam

### Export Options
- **CSV Export**: Raw data for further analysis
- **XLSX Export**: Formatted spreadsheet
- **PDF Reports**: Professional summary reports

## 📱 WhatsApp Integration

### Setup
1. Obtain WhatsApp Business API credentials
2. Add to environment variables:
   ```
   WHATSAPP_TOKEN=your_token
   WHATSAPP_PHONE_ID=your_phone_id
   ```
3. Configure templates in `/admin/settings`

### Sending Codes
1. Go to exam student management
2. Select students to send codes to
3. Choose template or customize message
4. Send individually or in bulk
5. Track delivery status in audit logs

## 🔍 Monitoring & Audit

### Live Monitoring (`/admin/monitoring`)
- **Active Attempts**: See who's currently taking exams
- **Recent Submissions**: Latest completed exams
- **System Activity**: Real-time activity feed
- **Performance Metrics**: Response times and error rates

### Audit Logs (`/admin/audit`)
- **Complete Activity Trail**: Every action is logged
- **Filter by**:
  - User/Actor
  - Action type
  - Date range
  - Exam/Student
- **Export**: Download audit logs for compliance

## 🔒 Security Management

### IP Restrictions
1. Navigate to exam settings
2. Add IP rules:
   - **Whitelist**: Only allow specific IPs/ranges
   - **Blacklist**: Block specific IPs/ranges
3. Use CIDR notation (e.g., `192.168.1.0/24`)

### Access Control
- **Admin Users**: Manage who has admin access
- **Session Management**: Control session timeouts
- **Attempt Validation**: Prevent duplicate submissions
- **Data Encryption**: All sensitive data is encrypted

## 🌍 Multi-language Support

### Language Configuration
1. Set default language in global settings
2. **Supported Languages**:
   - English (LTR)
   - Arabic (RTL)
3. **Customizable Text**:
   - Welcome messages
   - Instructions
   - Thank you messages
   - Error messages

### Content Management
- All exam content supports both languages
- Automatic text direction (RTL/LTR)
- Proper font rendering for Arabic text
- Localized date/time formatting

## 📋 Data Management

### Import Formats

#### Students CSV/XLSX
```csv
student_name,mobile_number,code
John Doe,+1234567890,1234
Jane Smith,+1234567891,5678
```

#### Questions CSV/XLSX
```csv
question_text,question_type,options,correct_answers,points
What is 2+2?,multiple_choice,"[""3"",""4"",""5""]","[""4""]",1
```

### Export Options
- **Results**: Student scores and detailed answers
- **Analytics**: Performance statistics and charts
- **Audit Logs**: Complete activity history
- **Student Data**: Contact information and codes

## 🛠️ Troubleshooting

### Common Issues

#### Students Can't Access Exam
1. Check exam status (must be "Published")
2. Verify start/end times
3. Check IP restrictions
4. Validate student codes

#### Performance Issues
1. Check database connection
2. Monitor server resources
3. Review audit logs for errors
4. Clear browser cache

#### WhatsApp Not Working
1. Verify API credentials
2. Check phone number format
3. Review message templates
4. Check rate limits

### System Maintenance
- **Regular Backups**: Schedule database backups
- **Update Dependencies**: Keep packages current
- **Monitor Logs**: Review error logs regularly
- **Performance Tuning**: Optimize database queries

## 📞 Support & Resources

### Documentation
- **README.md**: Setup and deployment guide
- **ROADMAP.md**: Feature development status
- **TESTING_SUMMARY.md**: Quality assurance results

### Technical Support
- Check audit logs for detailed error information
- Review browser console for client-side issues
- Monitor server logs for backend problems
- Use database query tools for data investigation

### Best Practices
1. **Regular Backups**: Schedule automated backups
2. **Security Updates**: Keep system updated
3. **User Training**: Train staff on admin features
4. **Testing**: Test exams before publishing
5. **Monitoring**: Set up alerts for system issues

---

**Need Help?** Check the audit logs first, then review the technical documentation for detailed troubleshooting steps.