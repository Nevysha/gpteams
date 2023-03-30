import './utils/loadEnv'
import express from 'express'
import history from 'connect-history-api-fallback'
import type { ChatMessage } from 'chatgpt'
import { chatReplyProcess } from './chatgpt'
import type { RequestProps } from './types'
import { checkAuth, isAdmin, isAuthenticated } from './middleware/auth'
import adminRouter from './routers/adminRouter'
import admin from './firebaseAdmin'

const app = express()
const router = express.Router()

app.use(history({
  index: '/',
}))
app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', checkAuth, async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { prompt, options = {}, systemMessage } = req.body as RequestProps
    let firstChunk = true

    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/verify', async (req, res) => {
  try {
    const Authorization = (req.header('Authorization') || '').replace('Bearer ', '').trim()
    const decodedToken = await admin.auth().verifyIdToken(Authorization)

    if (!await isAuthenticated(decodedToken)) {
      res.status(401).send({
        status: 'Unauthorized',
        message: 'Auth Error',
        data: null,
      })
      return
    }

    let role = 'user'

    if (await isAdmin(decodedToken))
      role = 'admin'

    res.status(200).send({
      status: 'Success',
      data: {
        role,
      },
    })
  }
  catch (error) {
    res.status(500).send(error.message)
  }
})

app.use('/api', router)
app.use('/api', adminRouter)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
