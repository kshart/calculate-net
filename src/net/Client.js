import nodes from '@/nodes/index'
import Channel from '@/core/Channel'
import outputTypes from './outputTypes'
import nodeManager from '@/core/NodeManager'
import EventEmitter from 'events'

/**
 * Класс предназначен для общения по сокету с клиентами.
 * @requires core.Channel
 * @requires core.NodeManager
 * @memberof net
 * @author Артём Каширин <kshart@yandex.ru>
 */
export default class Client extends EventEmitter {
  constructor ({ connection }) {
    super()
    /**
     * @type {net.connections.Connection}
     */
    this.connection = connection
    this.lastResposeId = 0
    connection
      .on('connect', () => console.log('connect'))
      .on('message', message => this.handleRequest(message))
      .on('close', () => this.destroy())
      .on('error', error => console.log(error))
  }

  /**
   * Деструктор клиента.
   */
  destroy () {
    for (let [, channel] of Channel.channels) {
      channel.clients.delete(this)
    }
    console.log('Client destroy')
  }

  /**
   * Отправить пакет
   * @param {String} method - Тип пакета.
   * @param {Object} params - "полезная нагрузка", зависит от типа пакета.
   * @param {String} requestId - ID запроса, для которого предназначен этот ответ.
   */
  send (method, params = {}, requestId = null) {
    this.lastResposeId++
    this.connection.send({
      id: this.lastResposeId,
      requestId,
      method,
      params
    })
  }

  /**
   * Обработать запрос
   * @param {Object} request Запрос.
   */
  handleRequest ({ id, requestId, method, params }) {
    const methodName = 'on' + method.capitalize()
    if (typeof this[methodName] === 'function') {
      this[methodName](params, { id, requestId })
    } else {
      console.log(`Метод "${methodName}" не найден`)
    }
  }

  /**
   * Ошибка
   */
  onError () {
    console.log('error')
  }

  /**
   * Метод возвращает информацию о сервере
   * @see module:net.SERVER_CONNECT_RESULT
   */
  onServerConnect () {
    this.send(outputTypes.serverHello, {
      name: 'me',
      nodeTypeSupport: Object.keys(nodes),
      nodesCount: nodeManager.nodes.size
    })
  }

  /**
   * Метод возвращает список id нод.
   * @return {Array<String>} список id доступных нод
   */
  onNodeGetList () {
    this.send(outputTypes.nodeList, {
      nodeIds: Array.from(nodeManager.nodes.keys())
    })
  }

  /**
   * Метод добавляет ноду в пул.
   */
  onNodeCreate ({ node }) {
    nodeManager.createNode(node)
      .then(node => node.start())
  }

  /**
   * Обновить конфигурацию ноды.
   */
  onNodeUpdate ({ node }) {
    console.warn('Нет реализации')
  }

  /**
   * Метод удаляет ноду из пул
   */
  onNodeRemove ({ nodeId }) {
    nodeManager.removeNode(nodeId)
  }

  /**
   * Метод мигрирует ноду.
   */
  onNodeMigrate ({ nodeId }) {
    nodeManager.migrateNode(nodeId)
      .then(nodeConf => console.log(nodeConf))
      .catch(err => console.log(err))
  }

  onNodeGetChannelList ({ nodeId }, { id }) {
    const node = nodeManager.nodes.get(nodeId)
    this.send(outputTypes.nodeChannelList, {
      nodeId,
      channels: node.listChannel()
    }, id)
  }

  onNodeChannelRead ({ channelId }) {
    const channel = Channel.channels.get(channelId)
    const { id, data } = channel
    this.send(outputTypes.nodeChannelUpdate, { id, data })
  }

  onNodeChannelSend ({ channelId, data }) {
    const channel = Channel.channels.get(channelId)
    channel.set(data)
    // if (!channel.clients.has(this)) {
    //   const { id, data } = channel
    //   // this.send(outputTypes.nodeChannelUpdate, { channel })
    // }
  }

  onNodeChannelWatch ({ channelId }) {
    const channel = Channel.channels.get(channelId)
    channel.watch(this)
    console.log(channel)
    const { id, data } = channel
    this.send(outputTypes.nodeChannelUpdate, { id, data })
  }

  onNodeChannelUnwatch ({ channelId }) {
    const channel = Channel.channels.get(channelId)
    channel.unwatch(this)
    // this.send(null)
  }
}
