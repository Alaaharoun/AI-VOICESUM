import { Platform, Share, Alert } from 'react-native';

export class DownloadHelper {
  /**
   * Download text content as a file
   */
  static downloadText(content: string, filename: string, format: 'txt' | 'rtf' | 'doc' = 'txt') {
    if (Platform.OS === 'web') {
      this.downloadTextWeb(content, filename, format);
    } else {
      this.downloadTextMobile(content, filename, format);
    }
  }

  /**
   * Download text on web platform
   */
  private static downloadTextWeb(content: string, filename: string, format: 'txt' | 'rtf' | 'doc' = 'txt') {
    let mimeType: string;
    let fileContent: string;
    let fileExtension: string;

    switch (format) {
      case 'rtf':
        mimeType = 'application/rtf';
        fileExtension = 'rtf';
        fileContent = this.convertToRTF(content);
        break;
      case 'doc':
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileExtension = 'html'; // HTML that can be opened by Word
        fileContent = this.convertToWordHTML(content);
        break;
      default:
        mimeType = 'text/plain';
        fileExtension = 'txt';
        fileContent = content;
    }

    const blob = new Blob([fileContent], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.${fileExtension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up the URL
    URL.revokeObjectURL(url);
  }

  /**
   * Download text on mobile platform using Share API
   */
  private static downloadTextMobile(content: string, filename: string, format: 'txt' | 'rtf' | 'doc' = 'txt') {
    let fileContent: string;
    let fileExtension: string;

    switch (format) {
      case 'rtf':
        fileExtension = 'rtf';
        fileContent = this.convertToRTF(content);
        break;
      case 'doc':
        fileExtension = 'html';
        fileContent = this.convertToWordHTML(content);
        break;
      default:
        fileExtension = 'txt';
        fileContent = content;
    }

    const fullFilename = `${filename}.${fileExtension}`;

    Share.share({
      title: 'Voice Transcription',
      message: content,
      url: undefined, // We can't create file URLs in React Native easily
    }).catch((error) => {
      console.error('Share failed:', error);
      Alert.alert('Download Error', 'Failed to share the file. You can copy the text manually.');
    });
  }

  /**
   * Convert plain text to RTF format
   */
  private static convertToRTF(text: string): string {
    const rtfHeader = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}';
    const rtfBody = text.replace(/\n/g, '\\par ');
    const rtfFooter = '}';
    
    return `${rtfHeader}\\f0\\fs24 ${rtfBody}${rtfFooter}`;
  }

  /**
   * Convert plain text to HTML format that Word can open
   */
  private static convertToWordHTML(text: string): string {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Voice Transcription</title>
    <style>
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12pt;
            line-height: 1.5;
            margin: 1in;
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 10px;
        }
        .content {
            white-space: pre-wrap;
        }
        .timestamp {
            color: #666;
            font-size: 10pt;
            margin-bottom: 15px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Voice Transcription</h1>
        <div class="timestamp">Generated on: ${new Date().toLocaleString()}</div>
    </div>
    <div class="content">${text.replace(/\n/g, '<br>')}</div>
</body>
</html>`;
    
    return htmlContent;
  }

  /**
   * Generate a filename with timestamp
   */
  static generateFilename(prefix: string = 'transcription'): string {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${prefix}_${timestamp}`;
  }
}