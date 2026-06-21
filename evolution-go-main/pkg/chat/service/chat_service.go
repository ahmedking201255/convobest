package chat_service

import (
	"context"
	"errors"
	"time"

	instance_model "github.com/EvolutionAPI/evolution-go/pkg/instance/model"
	logger_wrapper "github.com/EvolutionAPI/evolution-go/pkg/logger"
	"github.com/EvolutionAPI/evolution-go/pkg/utils"
	whatsmeow_service "github.com/EvolutionAPI/evolution-go/pkg/whatsmeow/service"
	"github.com/google/uuid"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/appstate"
	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"google.golang.org/protobuf/proto"
)

type ChatService interface {
	ChatPin(data *BodyStruct, instance *instance_model.Instance) (string, error)
	ChatUnpin(data *BodyStruct, instance *instance_model.Instance) (string, error)
	ChatArchive(data *BodyStruct, instance *instance_model.Instance) (string, error)
	ChatUnarchive(data *BodyStruct, instance *instance_model.Instance) (string, error)
	ChatMute(data *BodyStruct, instance *instance_model.Instance) (string, error)
	ChatUnmute(data *BodyStruct, instance *instance_model.Instance) (string, error)
	HistorySyncRequest(data *HistorySyncRequestStruct, instance *instance_model.Instance) (*whatsmeow.SendResponse, error)
	FullHistorySyncRequest(data *FullHistorySyncRequestStruct, instance *instance_model.Instance) (*FullHistorySyncResponseStruct, error)
}

type chatService struct {
	clientPointer    map[string]*whatsmeow.Client
	whatsmeowService whatsmeow_service.WhatsmeowService
	loggerWrapper    *logger_wrapper.LoggerManager
}

type BodyStruct struct {
	Chat string `json:"chat"`
}

type HistorySyncRequestStruct struct {
	MessageInfo *types.MessageInfo `json:"messageInfo"`
	Count       int                `json:"count"`
}

type FullHistorySyncRequestStruct struct {
	Days int `json:"days"`
}

type FullHistorySyncResponseStruct struct {
	RequestID string                  `json:"requestId"`
	Days      int                     `json:"days"`
	Since     int64                   `json:"since"`
	Response  *whatsmeow.SendResponse `json:"response"`
}

func (c *chatService) ensureClientConnected(instanceId string) (*whatsmeow.Client, error) {
	client := c.clientPointer[instanceId]
	c.loggerWrapper.GetLogger(instanceId).LogInfo("[%s] Checking client connection status - Client exists: %v", instanceId, client != nil)

	if client == nil {
		c.loggerWrapper.GetLogger(instanceId).LogInfo("[%s] No client found, attempting to start new instance", instanceId)
		err := c.whatsmeowService.StartInstance(instanceId)
		if err != nil {
			c.loggerWrapper.GetLogger(instanceId).LogError("[%s] Failed to start instance: %v", instanceId, err)
			return nil, errors.New("no active session found")
		}

		c.loggerWrapper.GetLogger(instanceId).LogInfo("[%s] Instance started, waiting 2 seconds...", instanceId)
		time.Sleep(2 * time.Second)

		client = c.clientPointer[instanceId]
		c.loggerWrapper.GetLogger(instanceId).LogInfo("[%s] Checking new client - Exists: %v, Connected: %v",
			instanceId,
			client != nil,
			client != nil && client.IsConnected())

		if client == nil || !client.IsConnected() {
			c.loggerWrapper.GetLogger(instanceId).LogError("[%s] New client validation failed - Exists: %v, Connected: %v",
				instanceId,
				client != nil,
				client != nil && client.IsConnected())
			return nil, errors.New("no active session found")
		}
	} else if !client.IsConnected() {
		c.loggerWrapper.GetLogger(instanceId).LogError("[%s] Existing client is disconnected - Connected status: %v",
			instanceId,
			client.IsConnected())
		return nil, errors.New("client disconnected")
	}

	c.loggerWrapper.GetLogger(instanceId).LogInfo("[%s] Client successfully validated - Connected: %v", instanceId, client.IsConnected())
	return client, nil
}

func (c *chatService) ChatPin(data *BodyStruct, instance *instance_model.Instance) (string, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return "", err
	}

	var ts time.Time

	recipient, ok := utils.ParseJID(data.Chat)
	if !ok {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] Error validating message fields", instance.Id)
		return "", errors.New("invalid phone number")
	}

	err = client.SendAppState(context.Background(), appstate.BuildPin(recipient, true))
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error pin chat: %v", instance.Id, err)
		return "", err
	}

	return ts.String(), nil
}

func (c *chatService) ChatUnpin(data *BodyStruct, instance *instance_model.Instance) (string, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return "", err
	}

	var ts time.Time

	recipient, ok := utils.ParseJID(data.Chat)
	if !ok {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] Error validating message fields", instance.Id)
		return "", errors.New("invalid phone number")
	}

	err = client.SendAppState(context.Background(), appstate.BuildPin(recipient, false))
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error unpin chat: %v", instance.Id, err)
		return "", err
	}

	return ts.String(), nil
}

func (c *chatService) ChatArchive(data *BodyStruct, instance *instance_model.Instance) (string, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return "", err
	}

	var ts time.Time

	recipient, ok := utils.ParseJID(data.Chat)
	if !ok {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] Error validating message fields", instance.Id)
		return "", errors.New("invalid phone number")
	}

	err = client.SendAppState(context.Background(), appstate.BuildArchive(recipient, true, time.Time{}, nil))
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error archive chat: %v", instance.Id, err)
		return "", err
	}

	return ts.String(), nil
}

func (c *chatService) ChatUnarchive(data *BodyStruct, instance *instance_model.Instance) (string, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return "", err
	}

	var ts time.Time

	recipient, ok := utils.ParseJID(data.Chat)
	if !ok {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] Error validating message fields", instance.Id)
		return "", errors.New("invalid phone number")
	}

	err = client.SendAppState(context.Background(), appstate.BuildArchive(recipient, false, time.Time{}, nil))
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error unarchive chat: %v", instance.Id, err)
		return "", err
	}

	return ts.String(), nil
}

func (c *chatService) ChatMute(data *BodyStruct, instance *instance_model.Instance) (string, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return "", err
	}

	var ts time.Time

	recipient, ok := utils.ParseJID(data.Chat)
	if !ok {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] Error validating message fields", instance.Id)
		return "", errors.New("invalid phone number")
	}

	err = client.SendAppState(context.Background(), appstate.BuildMute(recipient, true, 1*time.Hour))
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error mute chat: %v", instance.Id, err)
		return "", err
	}

	return ts.String(), nil
}

func (c *chatService) ChatUnmute(data *BodyStruct, instance *instance_model.Instance) (string, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return "", err
	}

	var ts time.Time

	recipient, ok := utils.ParseJID(data.Chat)
	if !ok {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] Error validating message fields", instance.Id)
		return "", errors.New("invalid phone number")
	}

	err = client.SendAppState(context.Background(), appstate.BuildMute(recipient, false, 0*time.Hour))
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error unmute chat: %v", instance.Id, err)
		return "", err
	}

	return ts.String(), nil
}

func (c *chatService) HistorySyncRequest(data *HistorySyncRequestStruct, instance *instance_model.Instance) (*whatsmeow.SendResponse, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return nil, err
	}

	messageInfo := types.MessageInfo{
		MessageSource: types.MessageSource{
			Chat:     data.MessageInfo.Chat,
			IsFromMe: data.MessageInfo.IsFromMe,
			IsGroup:  data.MessageInfo.IsGroup,
		},
		ID:        data.MessageInfo.ID,
		Timestamp: data.MessageInfo.Timestamp,
	}

	histRequest := client.BuildHistorySyncRequest(&messageInfo, data.Count)

	res, err := client.SendMessage(context.Background(), messageInfo.Chat, histRequest, whatsmeow.SendRequestExtra{Peer: true})
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error history sync request: %v", instance.Id, err)
		return nil, err
	}

	return &res, nil
}

func (c *chatService) FullHistorySyncRequest(data *FullHistorySyncRequestStruct, instance *instance_model.Instance) (*FullHistorySyncResponseStruct, error) {
	client, err := c.ensureClientConnected(instance.Id)
	if err != nil {
		return nil, err
	}

	const defaultFullHistorySyncDays = 7
	days := defaultFullHistorySyncDays
	if data != nil && data.Days > 0 {
		days = data.Days
	}
	if days > 90 {
		days = 90
	}

	requestID := uuid.New().String()
	since := time.Now().AddDate(0, 0, -days).Unix()
	c.loggerWrapper.GetLogger(instance.Id).LogInfo("[%s] requesting full history sync: requestID=%s days=%d since=%d", instance.Id, requestID, days, since)

	message := &waE2E.Message{
		ProtocolMessage: &waE2E.ProtocolMessage{
			Type: waE2E.ProtocolMessage_PEER_DATA_OPERATION_REQUEST_MESSAGE.Enum(),
			PeerDataOperationRequestMessage: &waE2E.PeerDataOperationRequestMessage{
				PeerDataOperationRequestType: waE2E.PeerDataOperationRequestType_FULL_HISTORY_SYNC_ON_DEMAND.Enum(),
				FullHistorySyncOnDemandRequest: &waE2E.PeerDataOperationRequestMessage_FullHistorySyncOnDemandRequest{
					RequestMetadata: &waE2E.FullHistorySyncOnDemandRequestMetadata{
						RequestID:       proto.String(requestID),
						BusinessProduct: proto.String("evolution-go"),
					},
					HistorySyncConfig: &waCompanionReg.DeviceProps_HistorySyncConfig{
						FullSyncDaysLimit:                        proto.Uint32(uint32(days)),
						StorageQuotaMb:                           proto.Uint32(10240),
						InlineInitialPayloadInE2EeMsg:            proto.Bool(true),
						RecentSyncDaysLimit:                      proto.Uint32(uint32(days)),
						SupportBotUserAgentChatHistory:           proto.Bool(true),
						SupportCagReactionsAndPolls:              proto.Bool(true),
						SupportBizHostedMsg:                      proto.Bool(true),
						SupportRecentSyncChunkMessageCountTuning: proto.Bool(true),
						SupportHostedGroupMsg:                    proto.Bool(true),
						SupportFbidBotChatHistory:                proto.Bool(true),
						SupportMessageAssociation:                proto.Bool(true),
						SupportGroupHistory:                      proto.Bool(true),
						OnDemandReady:                            proto.Bool(true),
						CompleteOnDemandReady:                    proto.Bool(true),
						ThumbnailSyncDaysLimit:                   proto.Uint32(uint32(days)),
						InitialSyncMaxMessagesPerChat:            proto.Uint32(100),
						SupportManusHistory:                      proto.Bool(true),
						SupportHatchHistory:                      proto.Bool(true),
						SupportInlineContacts:                    proto.Bool(true),
					},
					FullHistorySyncOnDemandConfig: &waE2E.FullHistorySyncOnDemandConfig{
						HistoryFromTimestamp: proto.Uint64(uint64(since)),
						HistoryDurationDays:  proto.Uint32(uint32(days)),
					},
				},
			},
		},
	}

	res, err := client.SendPeerMessage(context.Background(), message)
	if err != nil {
		c.loggerWrapper.GetLogger(instance.Id).LogError("[%s] error full history sync request: %v", instance.Id, err)
		return nil, err
	}
	c.loggerWrapper.GetLogger(instance.Id).LogInfo("[%s] full history sync request sent: requestID=%s messageID=%s days=%d", instance.Id, requestID, res.ID, days)

	return &FullHistorySyncResponseStruct{
		RequestID: requestID,
		Days:      days,
		Since:     since,
		Response:  &res,
	}, nil
}

func NewChatService(
	clientPointer map[string]*whatsmeow.Client,
	whatsmeowService whatsmeow_service.WhatsmeowService,
	loggerWrapper *logger_wrapper.LoggerManager,
) ChatService {
	return &chatService{
		clientPointer:    clientPointer,
		whatsmeowService: whatsmeowService,
		loggerWrapper:    loggerWrapper,
	}
}
