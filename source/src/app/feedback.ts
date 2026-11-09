// 意見回饋網址集中在這裡。之後改用 Google 表單時，只要把 FEEDBACK_URL 換成表單網址。
const GITHUB_NEW_ISSUE = 'https://github.com/sesns365/copybook/issues/new';
const TEMPLATE = '請描述遇到的情況或建議：\n\n\n（如果是語詞或注音有誤，請寫出版社、年級、課次與語詞）\n';
export const FEEDBACK_URL = GITHUB_NEW_ISSUE + '?title=' + encodeURIComponent('意見回饋：') + '&body=' + encodeURIComponent(TEMPLATE);
