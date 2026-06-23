import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/core/theme';
import { useThemeStore } from '@/core/theme/theme.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';

const AVATAR_COLORS = ['#F26522','#7C3AED','#059669','#2563EB','#DB2777','#D97706','#DC2626','#0891B2'];

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { isDark, toggle: toggleTheme } = useThemeStore();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [draftBio, setDraftBio] = useState(user?.bio ?? '');
  const [draftName, setDraftName] = useState(user?.name ?? '');
  const [draftColor, setDraftColor] = useState(user?.avatarColor ?? '#F26522');
  const [draftPhoto, setDraftPhoto] = useState<string | undefined>(user?.photoUri);

  const pickPhoto = async () => {
    if (!editing) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your photo library.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setDraftPhoto(result.assets[0].uri);
  };

  if (!user) return null;

  const createdCount = user.createdEvents.length;
  const joinedCount = user.joinedEvents.filter((id) => !user.createdEvents.includes(id)).length;
  const initials = user.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();

  const handleSave = () => {
    if (!draftName.trim()) { Alert.alert('Name required', 'Please enter your name.'); return; }
    updateProfile({ name: draftName.trim(), bio: draftBio.trim(), avatarColor: draftColor, photoUri: draftPhoto });
    setEditing(false);
  };
  const handleCancel = () => {
    setDraftBio(user.bio ?? ''); setDraftName(user.name); setDraftColor(user.avatarColor ?? '#F26522');
    setDraftPhoto(user.photoUri); setEditing(false);
  };

  return (
    <ScrollView style={[styles.root,{backgroundColor:colors.background}]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}>
        <Text style={[styles.pageTitle,{color:colors.textPrimary}]}>Profile</Text>
        <Pressable onPress={() => editing ? handleSave() : setEditing(true)} style={[styles.editBtn,{backgroundColor:editing?colors.primary:colors.surfaceVariant}]}>
          <Text style={[styles.editBtnLabel,{color:editing?'#fff':colors.textSecondary}]}>{editing?'Save':'Edit'}</Text>
        </Pressable>
      </View>

      <View style={styles.avatarSection}>
        <Pressable onPress={pickPhoto} style={styles.avatarWrap}>
          {(editing ? draftPhoto : user.photoUri) ? (
            <Image source={{ uri: editing ? draftPhoto : user.photoUri }} style={styles.avatarPhoto} />
          ) : (
            <View style={[styles.avatar,{backgroundColor:editing?draftColor:(user.avatarColor??colors.primary)}]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          {editing && (
            <View style={[styles.photoOverlay,{backgroundColor:'rgba(0,0,0,0.4)'}]}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          )}
        </Pressable>
        {editing && (
          <View style={styles.colorRow}>
            {AVATAR_COLORS.map((c) => (
              <Pressable key={c} onPress={() => setDraftColor(c)}
                style={[styles.colorDot,{backgroundColor:c},draftColor===c&&styles.colorDotSelected]} />
            ))}
          </View>
        )}
        {editing && (
          <Pressable onPress={() => setDraftPhoto(undefined)} style={[styles.removePhotoBtn,{borderColor:colors.border}]}>
            <Text style={[styles.removePhotoLabel,{color:colors.textHint}]}>Remove photo</Text>
          </Pressable>
        )}
      </View>

      {editing ? (
        <View style={[styles.inputBlock,{backgroundColor:colors.surface,borderColor:colors.border}]}>
          <Text style={[styles.inputLabel,{color:colors.textHint}]}>Name</Text>
          <TextInput value={draftName} onChangeText={setDraftName} style={[styles.textInput,{color:colors.textPrimary}]} placeholderTextColor={colors.textHint} />
        </View>
      ) : (
        <View style={styles.nameBlock}>
          <Text style={[styles.name,{color:colors.textPrimary}]}>{user.name}</Text>
          <Text style={[styles.email,{color:colors.textHint}]}>{user.universityEmail}</Text>
        </View>
      )}

      <View style={[styles.bioBlock,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <Text style={[styles.bioLabel,{color:colors.textHint}]}>Bio</Text>
        {editing ? (
          <TextInput value={draftBio} onChangeText={setDraftBio} style={[styles.bioInput,{color:colors.textPrimary}]}
            placeholder="Tell people about yourself..." placeholderTextColor={colors.textHint} multiline numberOfLines={3} textAlignVertical="top" />
        ) : (
          <Text style={[styles.bioText,{color:user.bio?colors.textPrimary:colors.textHint}]}>{user.bio||'Tap Edit to add a bio'}</Text>
        )}
      </View>

      {editing && <Pressable onPress={handleCancel} style={styles.cancelBtn}><Text style={[styles.cancelLabel,{color:colors.textHint}]}>Cancel</Text></Pressable>}

      <View style={[styles.infoCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel,{color:colors.textHint}]}>University</Text>
          <Text style={[styles.infoValue,{color:colors.textPrimary}]} numberOfLines={1}>{user.universityName}</Text>
        </View>
        <View style={[styles.divider,{backgroundColor:colors.border}]} />
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel,{color:colors.textHint}]}>Department</Text>
          <Text style={[styles.infoValue,{color:colors.textPrimary}]} numberOfLines={1}>{user.department}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {[{n:createdCount,label:'Created'},{n:joinedCount,label:'Joined'},{n:createdCount+joinedCount,label:'Total'}].map(({n,label})=>(
          <View key={label} style={[styles.statCard,{backgroundColor:colors.surface,borderColor:colors.border}]}>
            <Text style={[styles.statNumber,{color:colors.primary}]}>{n}</Text>
            <Text style={[styles.statLabel,{color:colors.textSecondary}]}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.settingRow,{backgroundColor:colors.surface,borderColor:colors.border}]}>
        <View style={styles.settingLeft}>
          <Text style={styles.settingIcon}>{isDark?'🌙':'☀️'}</Text>
          <Text style={[styles.settingLabel,{color:colors.textPrimary}]}>Dark mode</Text>
        </View>
        <Switch value={isDark} onValueChange={toggleTheme} trackColor={{false:'#E5E5EA',true:colors.primary}} thumbColor="#FFFFFF" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:{flex:1},
  content:{paddingHorizontal:Spacing.lg,gap:Spacing.lg},
  topRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  pageTitle:{fontSize:26,fontWeight:FontWeight.extrabold,letterSpacing:-0.5},
  editBtn:{paddingHorizontal:Spacing.md,paddingVertical:8,borderRadius:BorderRadius.full},
  editBtnLabel:{fontSize:FontSize.sm,fontWeight:FontWeight.bold},
  avatarSection:{alignItems:'center',gap:Spacing.md},
  avatarWrap:{position:'relative',width:84,height:84,borderRadius:42,overflow:'hidden'},
  avatar:{width:84,height:84,borderRadius:42,alignItems:'center',justifyContent:'center'},
  avatarPhoto:{width:84,height:84,borderRadius:42},
  avatarText:{color:'#fff',fontSize:30,fontWeight:FontWeight.bold},
  photoOverlay:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center'},
  cameraIcon:{fontSize:26},
  removePhotoBtn:{borderWidth:1,borderRadius:BorderRadius.full,paddingHorizontal:Spacing.md,paddingVertical:5},
  removePhotoLabel:{fontSize:FontSize.xs,fontWeight:FontWeight.medium},
  colorRow:{flexDirection:'row',gap:10,flexWrap:'wrap',justifyContent:'center'},
  colorDot:{width:34,height:34,borderRadius:17},
  colorDotSelected:{borderWidth:3,borderColor:'#fff',transform:[{scale:1.18}]},
  nameBlock:{alignItems:'center',gap:4},
  name:{fontSize:FontSize.xxl,fontWeight:FontWeight.bold,letterSpacing:-0.3},
  email:{fontSize:FontSize.sm},
  inputBlock:{borderWidth:1,borderRadius:BorderRadius.lg,paddingHorizontal:Spacing.md,paddingVertical:Spacing.sm},
  inputLabel:{fontSize:FontSize.xs,fontWeight:FontWeight.semibold,marginBottom:4},
  textInput:{fontSize:FontSize.base,fontWeight:FontWeight.medium},
  bioBlock:{borderWidth:1,borderRadius:BorderRadius.lg,padding:Spacing.md,minHeight:80},
  bioLabel:{fontSize:FontSize.xs,fontWeight:FontWeight.semibold,marginBottom:6},
  bioText:{fontSize:FontSize.md,lineHeight:22},
  bioInput:{fontSize:FontSize.md,lineHeight:22,minHeight:60},
  cancelBtn:{alignItems:'center'},
  cancelLabel:{fontSize:FontSize.sm,fontWeight:FontWeight.medium},
  infoCard:{borderWidth:1,borderRadius:BorderRadius.lg,paddingHorizontal:Spacing.md,...Shadow.sm},
  infoRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingVertical:Spacing.md,gap:Spacing.md},
  infoLabel:{fontSize:FontSize.sm,fontWeight:FontWeight.medium},
  infoValue:{fontSize:FontSize.md,fontWeight:FontWeight.semibold,flex:1,textAlign:'right'},
  divider:{height:1},
  statsRow:{flexDirection:'row',gap:Spacing.sm},
  statCard:{flex:1,borderWidth:1,borderRadius:BorderRadius.lg,padding:Spacing.md,alignItems:'center',gap:4,...Shadow.sm},
  statNumber:{fontSize:30,fontWeight:FontWeight.extrabold,letterSpacing:-1},
  statLabel:{fontSize:FontSize.xs,fontWeight:FontWeight.semibold},
  settingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderRadius:BorderRadius.lg,paddingHorizontal:Spacing.md,paddingVertical:14},
  settingLeft:{flexDirection:'row',alignItems:'center',gap:Spacing.sm},
  settingIcon:{fontSize:20},
  settingLabel:{fontSize:FontSize.base,fontWeight:FontWeight.medium},
});
