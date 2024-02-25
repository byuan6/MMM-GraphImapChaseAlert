# MMM-GraphImapChaseAlert
Charts Chase balance alert emails on graph

| Daily graph             |  w/ End of month projection |
:-------------------------:|:-------------------------:
![](https://github.com/studio-1b/MMM-GraphImapChaseAlert/latest-commit/main/docs/MMM-GraphImapChaseAlert%20projection%20Screenshot%20from%202024-02-25%2005-33-01.png)  |  ![](https://raw.githubusercontent.com/studio-1b/MMM-GraphImapChaseAlert/main/docs/MMM-GraphImapChaseAlert%20projection%20Screenshot%20from%202024-02-25%2005-33-01.png)


# Installation
### Step 1: Git Clone and install dependencies(npm install)
```bash
    cd ~/MagicMirror/modules
    git clone https://github.com/studio-1b/MMM-GraphImapChaseAlert.git
    cd MMM-GraphImapChaseAlert
    npm install
```

### Step 2: Enable Daily Balance Alert e-mail in your Chase account

Goto your Chase Banking website, and send alerts to your e-mail.

### Step 3: Enable your Google Account for IMAP

> [!WARNING]
> Your bank information may be sensative for you.  Please be sure you wish to have this information available to access in a internet accessible e-mail system.

You don't need Google, but if you send your alerts to Gmail, you need to activate IMAP for Google.

> [!WARNING]
> To enable IMAP for Google, you need to generate a different App password (than the one you use to login to Gmail), just for IMAP.  Same username is used in the configuration below.

[https://support.google.com/mail/answer/185833?hl=en](https://support.google.com/mail/answer/185833?hl=en)

### Step 4: Configure MagicMirror to display module

Add this entry to <MagicMirror root>/config/config.js, as entry in *modules: [* array, somewhere at end.

```js
    {
        module: "MMM-GraphImapChaseAlert",
        header: "Budget",
        position: "top_right",
        config: {
            width: 350,
            height: 300,

            imapAddress: "***<IMAP server address>***", //'imap.gmail.com',
            imapPort: ***<IMAP server port>***, //993
            tls: ***<true or false if encrypted>***, //true
            tlsOptions: ***<other options, need to use option in comment below, for Gmail IMAP>***
                // { servername: 'imap.gmail.com', }, //https://stackoverflow.com/questions/59633564/cannot-connect-to-gmail-using-imap
            username: "***<email address>***",
            password: "***<IMAP password>***",
        }
    },
```

