const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} = require('discord.js');
const crypto = require('crypto');
const GuildSettings = require('../../models/GuildSettings');
const RoleRequest = require('../../models/RoleRequest');
const Logger = require('../../utils/logger');
const config = require('../../config');

module.exports = {
  name: 'yetki-ver',
  aliases: ['yetkiver', 'role-grant', 'rol-ver'],
  description: 'Bir üyeye rol vermek için Developer onayına talep gönderir.',
  data: new SlashCommandBuilder()
    .setName('yetki-ver')
    .setDescription('Bir kullanıcıya rol verilmesi için Developer onayına talep yollar.')
    .addUserOption(option =>
      option.setName('kullanici')
        .setDescription('Rol verilmek istenen kullanıcı')
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('rol')
        .setDescription('Verilmek istenen rol')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute({ client, message, interaction, isSlash, guild, member, user, channel, args, reply }) {
    // Permission check: Member must have ManageRoles or Administrator
    if (!member.permissions.has(PermissionFlagsBits.ManageRoles) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return reply({ content: '❌ Bu komutu kullanabilmek için **Rolleri Yönet (Manage Roles)** yetkisine sahip olmalısınız!', ephemeral: true });
    }

    let targetMember = null;
    let targetRole = null;

    if (isSlash) {
      const targetUser = interaction.options.getUser('kullanici');
      targetRole = interaction.options.getRole('rol');
      targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
    } else {
      if (!args[0] || !args[1]) {
        return reply({ content: '❌ **Kullanım:** `!yetki-ver @kullanıcı @rol`' });
      }

      const targetId = args[0].replace(/[<@!>]/g, '');
      const roleId = args[1].replace(/[<@&>]/g, '');

      targetMember = await guild.members.fetch(targetId).catch(() => null);
      targetRole = guild.roles.cache.get(roleId) || guild.roles.cache.find(r => r.name.toLowerCase() === args[1].toLowerCase());
    }

    if (!targetMember) {
      return reply({ content: '❌ Belirtilen üye sunucuda bulunamadı!', ephemeral: true });
    }

    if (!targetRole) {
      return reply({ content: '❌ Belirtilen rol sunucuda bulunamadı!', ephemeral: true });
    }

    if (targetRole.managed) {
      return reply({ content: '❌ Entegrasyon veya bot tarafından yönetilen bir rolü veremezsiniz!', ephemeral: true });
    }

    // Role hierarchy check
    const botMember = await guild.members.fetchMe();
    if (targetRole.position >= botMember.roles.highest.position) {
      return reply({ content: '❌ Bu rol botun en yüksek rolünden daha yukarıda olduğu için verilemez!', ephemeral: true });
    }

    if (targetMember.roles.cache.has(targetRole.id)) {
      return reply({ content: `⚠️ Bu kullanıcı zaten **${targetRole.name}** rolüne sahip!`, ephemeral: true });
    }

    const settings = await GuildSettings.findOne({ guildId: guild.id });
    if (!settings || !settings.approvalChannelId) {
      return reply({
        content: '❌ Developer onay kanalı ayarlanmamış! Lütfen önce `/kurulum` yapın veya `/settings onay-kanal #kanal` belirleyin.',
        ephemeral: true
      });
    }

    const approvalChannel = guild.channels.cache.get(settings.approvalChannelId)
      || await guild.channels.fetch(settings.approvalChannelId).catch(() => null);

    if (!approvalChannel || !approvalChannel.isTextBased()) {
      return reply({ content: '❌ Ayarlanan Developer onay kanalı bulunamadı veya bir metin kanalı değil!', ephemeral: true });
    }

    const requestId = crypto.randomBytes(6).toString('hex');

    // Create role request in database
    await RoleRequest.create({
      requestId,
      guildId: guild.id,
      staffUserId: member.id,
      targetUserId: targetMember.id,
      roleId: targetRole.id,
      status: 'PENDING'
    });

    // Approval Embed
    const approvalEmbed = new EmbedBuilder()
      .setColor(config.colors.warning)
      .setTitle('🛡️ [YETKİ ONAY TALEBİ] Developer Kararı Bekleniyor')
      .setDescription(
        `Bir yetkili tarafından sunucuda rol verme talebi iletildi.\n` +
        `Bu rolün verilmesi için **Developer** onayı gereklidir.`
      )
      .addFields(
        { name: '👤 Hedef Kullanıcı', value: `${targetMember} (\`${targetMember.user.tag}\` - \`${targetMember.id}\`)`, inline: false },
        { name: '🎖️ Talep Edilen Rol', value: `${targetRole} (\`${targetRole.name}\` - \`${targetRole.id}\`)`, inline: true },
        { name: '🛡️ Talebi Açan Yetkili', value: `${member} (\`${member.user.tag}\`)`, inline: true },
        { name: '🆔 Talep Kodu', value: `\`${requestId}\``, inline: true }
      )
      .setFooter({ text: 'Onay veya red için aşağıdaki butonları kullanınız.', iconURL: guild.iconURL() })
      .setTimestamp();

    // Action buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`approve_role_${requestId}`)
        .setLabel('Onayla (Yetkiyi Ver)')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId(`reject_role_${requestId}`)
        .setLabel('Reddet')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('❌')
    );

    const approvalMsg = await approvalChannel.send({ embeds: [approvalEmbed], components: [row] });

    await RoleRequest.updateOne({ requestId }, { approvalMessageId: approvalMsg.id });

    const confirmationEmbed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle('⏳ Yetki Verme Talebi İletildi')
      .setDescription(
        `**${targetMember.displayName}** kullanıcısına **${targetRole.name}** rolünü vermek için Developer onayına talep gönderildi!\n\n` +
        `📋 **Talep Kodu:** \`${requestId}\`\n` +
        `📡 **İletilen Kanal:** <#${settings.approvalChannelId}>\n\n` +
        `*Developer onay butonuna tıkladığı anda rol kullanıcıya otomatik olarak tanımlanacaktır.*`
      )
      .setTimestamp();

    await reply({ embeds: [confirmationEmbed] });
    Logger.info(`[Yetki Talebi] ${member.user.tag}, ${targetMember.user.tag} için ${targetRole.name} rol talebi oluşturdu (ID: ${requestId}).`);
  }
};
