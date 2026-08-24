#!/bin/bash

cd "$(dirname "$0")"

filenames=`ls ./*.mp4`

for entry in $filenames
 do
 	filename=$(basename $entry)
 	clearname=${filename%.*}
 	mkdir $clearname
 	cd $clearname
 	echo $filename;
 		ffmpeg -i ../"$filename" -vcodec libwebp -ss 00:00:0.0 -t 10 -filter:v fps=fps=20 -lossless 0  -compression_level 3 -q:v 70 -loop 1 -preset picture  -an -vsync 0 -s 800:600 ../"$clearname"/"$clearname"_animation.webp
 		ffmpeg -i ../"$filename" -c:v libx265 -crf 32 -vf scale=2560:-2 -preset medium -tag:v hvc1 -movflags faststart -an ../"$clearname"/"$clearname"_2560p.mp4
 		ffmpeg -i ../"$filename" -c:v libx265 -crf 32 -vf scale=1920:-2 -preset medium -tag:v hvc1 -movflags faststart -an ../"$clearname"/"$clearname"_1080p.mp4
 		ffmpeg -i ../"$filename" -c:v libx265 -crf 32 -vf scale=960:-2 -preset medium -tag:v hvc1 -movflags faststart -an ../"$clearname"/"$clearname"_540p.mp4
        ffmpeg -i ../"$filename" -c:v libx265 -crf 32 -vf scale=426:-2 -preset medium -tag:v hvc1 -movflags faststart -an ../"$clearname"/"$clearname"_240p.mp4
	cd ..
done


# FAST VARIANT

#cd "$(dirname "$0")"
#
#filenames=`ls ./*.mp4`
#
#for entry in $filenames
#do
#	filename=$(basename $entry)
#	clearname=${filename%.*}
#	mkdir $clearname
#	cd $clearname
#	echo $filename;
#		ffmpeg -i ../"$filename" -vcodec libwebp -ss 00:00:0.0 -t 10 -filter:v fps=fps=20 -lossless 0  -compression_level 3 -q:v 70 -loop 1 -preset picture  -an -vsync 0 -s 800:600 ../"$clearname"/"$clearname"_animation.webp
#		ffmpeg -i ../"$filename" -crf 32 -vf scale=2560:-2 -deadline best -movflags faststart -an ../"$clearname"/"$clearname"_2560p.mp4
#		ffmpeg -i ../"$filename" -crf 32 -vf scale=1920:-2 -deadline best -movflags faststart -an ../"$clearname"/"$clearname"_1080p.mp4
#		ffmpeg -i ../"$filename" -crf 32 -vf scale=960:-2 -deadline best -movflags faststart -an ../"$clearname"/"$clearname"_540p.mp4
#		ffmpeg -i ../"$filename" -crf 32 -vf scale=426:-2 -deadline best -movflags faststart -an ../"$clearname"/"$clearname"_240p.mp4
#	cd ..
#done