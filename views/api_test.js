const fetch = require('node-fetch')

const PRICE_ENDPOINT = 'https://api.porssisahko.net/v1/price.json'

const dateAndTimeNow = new Date()
const date = dateAndTimeNow.toISOString().split('T')[0]
const hour = dateAndTimeNow.getHours()

const getPrice = async () => {
  const response = await fetch(`${PRICE_ENDPOINT}?date=${date}&hour=${hour}`)
  const { price } = await response.json()
  console.log(`Hinta nyt on ${price}`)
}

getPrice()
